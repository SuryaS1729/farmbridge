import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { z } from "zod";

import type { createDb } from "../db/client";
import { commodities, dailyPrices, deals, farmerAddresses, farmerProfile, offerEvents, offers } from "../db/schema";
import { createFarmerAddress, ensureFarmerProfileId } from "../lib/farmer-addresses";
import { MAX_ADDRESSES_PER_FARMER } from "../validation/farmer-address";
import { getBusinessDate } from "../lib/business-date";
import { withVerifiedActor } from "../lib/with-verified-actor";
import {
  decimalToTenThousandths,
  quantityToKilograms,
  submitOfferSchema,
} from "../validation/quotes";

const routes = new Hono<{ Bindings: CloudflareBindings }>();

type Database = ReturnType<typeof createDb>["db"];
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type OfferInput = z.infer<typeof submitOfferSchema>;

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
          offerPickupLocation: offers.pickupLocation,
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
          collectedOn: deals.collectedOn,
          collectedWeightKg: deals.collectedWeightKg,
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
          collectedWeightQuintals: offer.collectedWeightKg
            ? kilogramsToQuintals(offer.collectedWeightKg)
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
        .select({
          id: deals.id,
          offerId: deals.offerId,
          status: deals.status,
          pickupLocation: deals.pickupLocation,
          collectedOn: deals.collectedOn,
        })
        .from(deals)
        .innerJoin(farmerProfile, eq(deals.farmerId, farmerProfile.id))
        .where(and(
          eq(deals.id, dealId.data),
          eq(farmerProfile.authUserId, actor.id),
        ))
        .for("update");
      if (!deal) return { kind: "missing" as const };
      if (deal.status !== "open") return { kind: "closed" as const };
      // The driver has already been there; changing directions now would only mislead the admin.
      if (deal.collectedOn) return { kind: "collected" as const };

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
    if (result.kind === "collected") {
      return c.json({ error: "Your cocoa has already been collected, so the pickup location can no longer be changed." }, 409);
    }
    return c.json({ pickupLocation: parsed.data.pickupLocation });
  });
});

/**
 * Today's published cocoa price, row-locked so a price republish can't slip
 * between the base-price check and the write.
 */
async function lockTodaysPrice(tx: Transaction, businessDate: string) {
  const [cocoa] = await tx
    .select({ id: commodities.id })
    .from(commodities)
    .where(and(eq(commodities.name, "Cocoa"), eq(commodities.isActive, true)))
    .limit(1);
  if (!cocoa) return { kind: "cocoa_missing" as const };

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
  if (!price) return { kind: "price_missing" as const };

  return { kind: "ok" as const, price };
}

/** The address text to copy onto the quote: a saved address, or a new one saved now. */
async function resolvePickupLocation(tx: Transaction, profileId: string, input: OfferInput) {
  if (input.pickupAddressId) {
    const [saved] = await tx
      .select({ address: farmerAddresses.address })
      .from(farmerAddresses)
      .where(
        and(
          eq(farmerAddresses.id, input.pickupAddressId),
          eq(farmerAddresses.farmerId, profileId),
        ),
      )
      .limit(1);
    if (!saved) return { kind: "address_missing" as const };
    return { kind: "ok" as const, pickupLocation: saved.address };
  }

  // A new address typed into the quote form is saved for next time.
  const created = await createFarmerAddress(tx, profileId, input.newPickupAddress!);
  if (!created) return { kind: "address_limit" as const };
  return { kind: "ok" as const, pickupLocation: created.address };
}

type QuoteProblem =
  | { kind: "cocoa_missing" }
  | { kind: "price_missing" }
  | { kind: "below_base_price"; basePricePerKg: string }
  | { kind: "address_missing" }
  | { kind: "address_limit" };

/** The shared checks for a new or revised quote: today's price, the base price, the pickup address. */
async function checkQuote(tx: Transaction, profileId: string, input: OfferInput, businessDate: string) {
  const priceResult = await lockTodaysPrice(tx, businessDate);
  if (priceResult.kind !== "ok") return priceResult;
  const { price } = priceResult;

  if (decimalToTenThousandths(input.offeredPricePerKg) < decimalToTenThousandths(price.basePricePerKg)) {
    return { kind: "below_base_price" as const, basePricePerKg: price.basePricePerKg };
  }

  const pickup = await resolvePickupLocation(tx, profileId, input);
  if (pickup.kind !== "ok") return pickup;

  return { kind: "ok" as const, price, pickupLocation: pickup.pickupLocation };
}

function quoteProblemResponse(c: Context<{ Bindings: CloudflareBindings }>, problem: QuoteProblem) {
  switch (problem.kind) {
    case "cocoa_missing":
      return c.json({ error: "The Cocoa commodity has not been seeded." }, 500);
    case "price_missing":
      return c.json({ error: "No cocoa price has been published for today." }, 409);
    case "below_base_price":
      return c.json(
        {
          error: "Offer price must meet or exceed today's cocoa base price.",
          basePricePerKg: problem.basePricePerKg,
        },
        422,
      );
    case "address_missing":
      return c.json({ error: "That saved address no longer exists. Choose another one." }, 409);
    case "address_limit":
      return c.json(
        {
          error: `You already have ${MAX_ADDRESSES_PER_FARMER} saved addresses. Pick one of them or delete one in Profile → Addresses.`,
        },
        409,
      );
  }
}

/** Reads and validates a quote body; returns the error response instead when it is invalid. */
async function parseOfferBody(c: Context<{ Bindings: CloudflareBindings }>) {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return { response: c.json({ error: "Request body must be valid JSON." }, 400) };
  }

  const parsed = submitOfferSchema.safeParse(body);
  if (!parsed.success) {
    return {
      response: c.json(
        { error: "Quote details are invalid.", fields: parsed.error.flatten().fieldErrors },
        400,
      ),
    };
  }

  if (Boolean(parsed.data.pickupAddressId) === Boolean(parsed.data.newPickupAddress)) {
    return { response: c.json({ error: "Choose one pickup address for this quote." }, 400) };
  }

  return { input: parsed.data };
}

/** The quote fields as stored in the audit trail. */
function quoteEventValues(input: OfferInput, quantityKg: string, pickupLocation: string) {
  return {
    offeredPricePerKg: input.offeredPricePerKg,
    quantity: input.quantity,
    quantityUnit: input.quantityUnit,
    quantityKg,
    moisturePercent: input.moisturePercent,
    beanCountPer100g: input.beanCountPer100g,
    readyOn: input.readyOn,
    pickupLocation,
  };
}

routes.post("/api/offers", async (c) => {
  const parsed = await parseOfferBody(c);
  if (!parsed.input) return parsed.response;
  const input = parsed.input;

  return withVerifiedActor(c, ["farmer"], async (db, actor) => {
    const businessDate = getBusinessDate();
    const now = new Date();
    const quantityKg = quantityToKilograms(input.quantity, input.quantityUnit);

    try {
      const result = await db.transaction(async (tx) => {
        const profile = { id: await ensureFarmerProfileId(tx, actor.id) };

        const checked = await checkQuote(tx, profile.id, input, businessDate);
        if (checked.kind !== "ok") return checked;
        const { price, pickupLocation } = checked;

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
            offeredPricePerKg: input.offeredPricePerKg,
            quantityKg,
            moisturePercent: input.moisturePercent.toString(),
            beanCountPer100g: input.beanCountPer100g.toString(),
            readyOn: input.readyOn,
            pickupLocation,
            submittedAt: now,
            expiresAt: endOfBusinessDay(businessDate),
          })
          .returning();

        await tx.insert(offerEvents).values({
          offerId: offer.id,
          eventType: "submitted",
          newValues: quoteEventValues(input, quantityKg, pickupLocation),
          actorType: "farmer",
          actorId: actor.id,
        });

        return { kind: "submitted" as const, offer };
      });

      if (result.kind !== "submitted") return quoteProblemResponse(c, result);
      return c.json({ offer: result.offer }, 201);
    } catch (error) {
      if (postgresCode(error) === "23505") {
        return c.json({ error: "You already have an active cocoa quote." }, 409);
      }
      throw error;
    }
  });
});

// The farmer can change any detail of their open quote until the buying team decides.
// A revised quote goes back to "pending", which is how a quote flagged by a price
// increase gets unstuck. It keeps its original expiry (end of the business day).
routes.post("/api/offers/:offerId/revise", async (c) => {
  const offerId = z.string().uuid().safeParse(c.req.param("offerId"));
  if (!offerId.success) return c.json({ error: "Invalid quote ID." }, 400);

  const parsed = await parseOfferBody(c);
  if (!parsed.input) return parsed.response;
  const input = parsed.input;

  return withVerifiedActor(c, ["farmer"], async (db, actor) => {
    const businessDate = getBusinessDate();
    const now = new Date();
    const quantityKg = quantityToKilograms(input.quantity, input.quantityUnit);

    const result = await db.transaction(async (tx) => {
      // Locking the quote makes a revise and an admin accept/reject take turns.
      const [offer] = await tx
        .select({
          id: offers.id,
          farmerId: offers.farmerId,
          status: offers.status,
          expiresAt: offers.expiresAt,
          offeredPricePerKg: offers.offeredPricePerKg,
          quantityKg: offers.quantityKg,
          moisturePercent: offers.moisturePercent,
          beanCountPer100g: offers.beanCountPer100g,
          readyOn: offers.readyOn,
          pickupLocation: offers.pickupLocation,
        })
        .from(offers)
        .innerJoin(farmerProfile, eq(offers.farmerId, farmerProfile.id))
        .where(and(eq(offers.id, offerId.data), eq(farmerProfile.authUserId, actor.id)))
        .for("update", { of: offers });
      if (!offer) return { kind: "missing" as const };
      if (offer.status !== "pending" && offer.status !== "invalid_needs_revision") {
        return { kind: "not_open" as const };
      }
      if (offer.expiresAt <= now) {
        await tx.update(offers).set({ status: "expired" }).where(eq(offers.id, offer.id));
        await tx.insert(offerEvents).values({
          offerId: offer.id,
          eventType: "expired",
          oldValues: { status: offer.status },
          newValues: { status: "expired" },
          reason: "Offer expired at the end of the business day.",
          actorType: "system",
        });
        return { kind: "expired" as const };
      }

      const checked = await checkQuote(tx, offer.farmerId, input, businessDate);
      if (checked.kind !== "ok") return checked;
      const { price, pickupLocation } = checked;

      const [revised] = await tx
        .update(offers)
        .set({
          dailyPriceId: price.id,
          offeredPricePerKg: input.offeredPricePerKg,
          quantityKg,
          moisturePercent: input.moisturePercent.toString(),
          beanCountPer100g: input.beanCountPer100g.toString(),
          readyOn: input.readyOn,
          pickupLocation,
          status: "pending",
        })
        .where(eq(offers.id, offer.id))
        .returning();

      await tx.insert(offerEvents).values({
        offerId: offer.id,
        eventType: "revised",
        oldValues: {
          status: offer.status,
          offeredPricePerKg: offer.offeredPricePerKg,
          quantityKg: offer.quantityKg,
          moisturePercent: offer.moisturePercent,
          beanCountPer100g: offer.beanCountPer100g,
          readyOn: offer.readyOn,
          pickupLocation: offer.pickupLocation,
        },
        newValues: { status: "pending", ...quoteEventValues(input, quantityKg, pickupLocation) },
        actorType: "farmer",
        actorId: actor.id,
      });

      return { kind: "revised" as const, offer: revised };
    });

    if (result.kind === "missing") return c.json({ error: "Quote not found." }, 404);
    if (result.kind === "not_open") {
      return c.json(
        { error: "The buying team has already decided on this quote, so it can no longer be changed." },
        409,
      );
    }
    if (result.kind === "expired") {
      return c.json({ error: "This quote expired at the end of the day. Make a new offer instead." }, 410);
    }
    if (result.kind !== "revised") return quoteProblemResponse(c, result);
    return c.json({ offer: result.offer });
  });
});

export default routes;
