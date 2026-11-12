import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { commodities, dailyPrices, deals, farmerProfile, offerEvents, offers } from "../db/schema";
import { getBusinessDate } from "../lib/business-date";
import { withVerifiedActor } from "../lib/with-verified-actor";
import {
  decimalToTenThousandths,
  quantityToKilograms,
  submitOfferSchema,
} from "../validation/quotes";

const routes = new Hono<{ Bindings: CloudflareBindings }>();

function endOfBusinessDay(businessDate: string) {
  const start = new Date(`${businessDate}T00:00:00+05:30`);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function postgresCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  return typeof error.code === "string" ? error.code : undefined;
}

function kilogramsToQuintals(value: string) {
  const [whole, fraction = ""] = value.split(".");
  const milliKilograms = BigInt(whole) * 1_000n + BigInt(fraction.padEnd(3, "0"));
  const wholeQuintals = milliKilograms / 100_000n;
  const fractionQuintals = (milliKilograms % 100_000n)
    .toString()
    .padStart(5, "0")
    .replace(/0+$/, "");
  return fractionQuintals ? `${wholeQuintals}.${fractionQuintals}` : wholeQuintals.toString();
}

routes.get("/api/offers/mine", async (c) =>
  withVerifiedActor(c, ["farmer"], async (db, actor) => {
    const now = new Date();
    return db.transaction(async (tx) => {
      const [profile] = await tx
        .select({ id: farmerProfile.id })
        .from(farmerProfile)
        .where(eq(farmerProfile.authUserId, actor.id))
        .limit(1);
      if (!profile) return c.json({ offers: [] });

      const expired = await tx
        .select({ id: offers.id, status: offers.status })
        .from(offers)
        .where(
          and(
            eq(offers.farmerId, profile.id),
            inArray(offers.status, ["pending", "invalid_needs_revision"]),
            lte(offers.expiresAt, now),
          ),
        );
      if (expired.length > 0) {
        const expiredIds = expired.map(({ id }) => id);
        await tx
          .update(offers)
          .set({ status: "expired", updatedAt: now })
          .where(inArray(offers.id, expiredIds));
        await tx.insert(offerEvents).values(
          expired.map(({ id, status }) => ({
            offerId: id,
            eventType: "expired",
            oldValues: { status },
            newValues: { status: "expired" },
            reason: "Offer expired at the end of the business day.",
            actorType: "system",
          })),
        );
      }

      const rows = await tx
        .select({
          id: offers.id,
          offeredPricePerKg: offers.offeredPricePerKg,
          quantityKg: offers.quantityKg,
          moisturePercent: offers.moisturePercent,
          beanCountPer100g: offers.beanCountPer100g,
          readyOn: offers.readyOn,
          status: offers.status,
          rejectionReason: offers.rejectionReason,
          submittedAt: offers.submittedAt,
          expiresAt: offers.expiresAt,
          dealId: deals.id,
          dealStatus: deals.status,
          acceptedAt: deals.acceptedAt,
          dealOfferedPricePerKg: deals.offeredPricePerKg,
          dealQuantityKg: deals.quantityKg,
          dealMoisturePercent: deals.moisturePercent,
          dealBeanCountPer100g: deals.beanCountPer100g,
          dealReadyOn: deals.readyOn,
          pickupLocation: deals.pickupLocation,
          pickupScheduledOn: deals.pickupScheduledOn,
        })
        .from(offers)
        .leftJoin(deals, eq(deals.offerId, offers.id))
        .where(eq(offers.farmerId, profile.id))
        .orderBy(desc(offers.submittedAt))
        .limit(100);

      return c.json({
        offers: rows.map((offer) => ({
          ...offer,
          quantityQuintals: kilogramsToQuintals(offer.quantityKg),
          dealQuantityQuintals: offer.dealQuantityKg
            ? kilogramsToQuintals(offer.dealQuantityKg)
            : null,
        })),
      });
    });
  }),
);

routes.post("/api/deals/:dealId/pickup-location", async (c) => {
  const dealId = z.string().uuid().safeParse(c.req.param("dealId"));
  if (!dealId.success) return c.json({ error: "Invalid deal ID." }, 400);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON." }, 400);
  }
  const parsed = z.object({
    pickupLocation: z.string().trim().min(5).max(500),
  }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Enter a pickup location between 5 and 500 characters." }, 400);
  }

  return withVerifiedActor(c, ["farmer"], async (db, actor) => {
    const result = await db.transaction(async (tx) => {
      const [deal] = await tx
        .select({ id: deals.id, offerId: deals.offerId, status: deals.status, pickupLocation: deals.pickupLocation })
        .from(deals)
        .innerJoin(farmerProfile, eq(deals.farmerId, farmerProfile.id))
        .where(and(
          eq(deals.id, dealId.data),
          eq(farmerProfile.authUserId, actor.id),
        ))
        .for("update");
      if (!deal) return { kind: "missing" as const };
      if (deal.status !== "open") return { kind: "closed" as const };

      await tx.update(deals).set({ pickupLocation: parsed.data.pickupLocation }).where(eq(deals.id, deal.id));
      await tx.insert(offerEvents).values({
        offerId: deal.offerId,
        eventType: deal.pickupLocation ? "pickup_location_updated" : "pickup_location_provided",
        oldValues: { pickupLocationProvided: Boolean(deal.pickupLocation) },
        newValues: { pickupLocationProvided: true },
        actorType: "farmer",
        actorId: actor.id,
      });
      return { kind: "saved" as const };
    });

    if (result.kind === "missing") return c.json({ error: "Deal not found." }, 404);
    if (result.kind === "closed") return c.json({ error: "Pickup location can only be updated for an open deal." }, 409);
    return c.json({ pickupLocation: parsed.data.pickupLocation });
  });
});

routes.post("/api/offers", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON." }, 400);
  }

  const parsed = submitOfferSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Quote details are invalid.", fields: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  return withVerifiedActor(c, ["farmer"], async (db, actor) => {
    const businessDate = getBusinessDate();
    const now = new Date();
    const quantityKg = quantityToKilograms(
      parsed.data.quantity,
      parsed.data.quantityUnit,
    );

    try {
      const result = await db.transaction(async (tx) => {
        const [cocoa] = await tx
          .select({ id: commodities.id })
          .from(commodities)
          .where(and(eq(commodities.name, "Cocoa"), eq(commodities.isActive, true)))
          .limit(1);

        if (!cocoa) {
          return { kind: "cocoa_missing" as const };
        }

        const [price] = await tx
          .select()
          .from(dailyPrices)
          .where(
            and(
              eq(dailyPrices.commodityId, cocoa.id),
              eq(dailyPrices.businessDate, businessDate),
              eq(dailyPrices.status, "published"),
            ),
          )
          .for("update");

        if (!price) {
          return { kind: "price_missing" as const };
        }

        if (
          decimalToTenThousandths(parsed.data.offeredPricePerKg) <
          decimalToTenThousandths(price.basePricePerKg)
        ) {
          return {
            kind: "below_base_price" as const,
            basePricePerKg: price.basePricePerKg,
          };
        }

        await tx
          .insert(farmerProfile)
          .values({ authUserId: actor.id })
          .onConflictDoNothing({ target: farmerProfile.authUserId });

        const [profile] = await tx
          .select({ id: farmerProfile.id })
          .from(farmerProfile)
          .where(eq(farmerProfile.authUserId, actor.id))
          .limit(1);

        if (!profile) {
          throw new Error("Farmer profile could not be created.");
        }

        const expiredOffers = await tx
          .select({ id: offers.id })
          .from(offers)
          .where(
            and(
              eq(offers.farmerId, profile.id),
              inArray(offers.status, ["pending", "invalid_needs_revision"]),
              lte(offers.expiresAt, now),
            ),
          );

        if (expiredOffers.length > 0) {
          const expiredIds = expiredOffers.map(({ id }) => id);
          await tx
            .update(offers)
            .set({ status: "expired", updatedAt: now })
            .where(inArray(offers.id, expiredIds));
          await tx.insert(offerEvents).values(
            expiredIds.map((offerId) => ({
              offerId,
              eventType: "expired",
              reason: "Offer expired at the end of the business day.",
              actorType: "system",
            })),
          );
        }

        const [offer] = await tx
          .insert(offers)
          .values({
            farmerId: profile.id,
            dailyPriceId: price.id,
            offeredPricePerKg: parsed.data.offeredPricePerKg,
            quantityKg,
            moisturePercent: parsed.data.moisturePercent.toString(),
            beanCountPer100g: parsed.data.beanCountPer100g.toString(),
            readyOn: parsed.data.readyOn,
            submittedAt: now,
            expiresAt: endOfBusinessDay(businessDate),
          })
          .returning();

        await tx.insert(offerEvents).values({
          offerId: offer.id,
          eventType: "submitted",
          newValues: {
            offeredPricePerKg: parsed.data.offeredPricePerKg,
            quantity: parsed.data.quantity,
            quantityUnit: parsed.data.quantityUnit,
            quantityKg,
            moisturePercent: parsed.data.moisturePercent,
            beanCountPer100g: parsed.data.beanCountPer100g,
            readyOn: parsed.data.readyOn,
          },
          actorType: "farmer",
          actorId: actor.id,
        });

        return { kind: "submitted" as const, offer };
      });

      if (result.kind === "cocoa_missing") {
        return c.json({ error: "The Cocoa commodity has not been seeded." }, 500);
      }
      if (result.kind === "price_missing") {
        return c.json({ error: "No cocoa price has been published for today." }, 409);
      }
      if (result.kind === "below_base_price") {
        return c.json(
          {
            error: "Offer price must meet or exceed today's cocoa base price.",
            basePricePerKg: result.basePricePerKg,
          },
          422,
        );
      }

      return c.json({ offer: result.offer }, 201);
    } catch (error) {
      if (postgresCode(error) === "23505") {
        return c.json({ error: "You already have an active cocoa quote." }, 409);
      }
      throw error;
    }
  });
});

export default routes;
