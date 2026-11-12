import { and, desc, eq, gte, gt, inArray, lte } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import {
  dailyPrices,
  deals,
  farmerProfile,
  offerEvents,
  offers,
  user,
} from "../db/schema";
import { getBusinessDate } from "../lib/business-date";
import { withVerifiedActor } from "../lib/with-verified-actor";
import { quantityToKilograms, recordCollectionSchema } from "../validation/quotes";

const routes = new Hono<{ Bindings: CloudflareBindings }>();

const calendarDateQuery = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  });

const offerQuerySchema = z.object({
  status: z.enum(["open", "pending", "invalid_needs_revision"]).default("open"),
  minOfferedPricePerKg: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/).optional(),
  maxOfferedPricePerKg: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/).optional(),
  minQuantityQuintals: z.string().regex(/^\d{1,7}(?:\.\d{1,5})?$/).optional(),
  maxQuantityQuintals: z.string().regex(/^\d{1,7}(?:\.\d{1,5})?$/).optional(),
  minMoisturePercent: z.string().regex(/^\d{1,3}(?:\.\d{1,4})?$/).optional(),
  maxMoisturePercent: z.string().regex(/^\d{1,3}(?:\.\d{1,4})?$/).optional(),
  minBeanCountPer100g: z.string().regex(/^\d{1,6}(?:\.\d{1,4})?$/).optional(),
  maxBeanCountPer100g: z.string().regex(/^\d{1,6}(?:\.\d{1,4})?$/).optional(),
  readyFrom: calendarDateQuery.optional(),
  readyTo: calendarDateQuery.optional(),
});

function normalizePhoneNumber(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function kilogramsToQuintals(value: string) {
  const [whole, fraction = ""] = value.split(".");
  const milliKilograms =
    BigInt(whole) * 1_000n + BigInt(fraction.padEnd(3, "0"));
  const wholeQuintals = milliKilograms / 100_000n;
  const fractionQuintals = (milliKilograms % 100_000n)
    .toString()
    .padStart(5, "0")
    .replace(/0+$/, "");

  return fractionQuintals
    ? `${wholeQuintals}.${fractionQuintals}`
    : wholeQuintals.toString();
}

function quintalsToKilograms(value: string) {
  const [whole, fraction = ""] = value.split(".");
  const milliKilograms =
    BigInt(whole) * 100_000n + BigInt(fraction.padEnd(5, "0"));
  const kilograms = milliKilograms / 1_000n;
  const remainder = (milliKilograms % 1_000n).toString().padStart(3, "0");
  return `${kilograms}.${remainder}`;
}

routes.post("/api/admin/claim", (c) =>
  withVerifiedActor(c, ["farmer", "admin"], async (db, actor) => {
    const configuredPhone = c.env.ADMIN_PHONE_NUMBER;
    if (!configuredPhone) {
      return c.json({ error: "Admin phone authorization is not configured." }, 503);
    }

    if (
      !actor.phoneNumber ||
      normalizePhoneNumber(actor.phoneNumber) !== normalizePhoneNumber(configuredPhone)
    ) {
      return c.json({ error: "This verified phone number is not authorized for admin access." }, 403);
    }

    await db
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.id, actor.id));

    return c.json({ role: "admin" });
  }),
);

routes.get("/api/admin/offers", async (c) => {
  const query = Object.fromEntries(new URL(c.req.url).searchParams.entries());
  const parsed = offerQuerySchema.safeParse(query);
  if (!parsed.success) {
    return c.json({ error: "Invalid quote filters.", fields: parsed.error.flatten().fieldErrors }, 400);
  }

  const filters = parsed.data;
  const statusesByFilter = {
    open: ["pending", "invalid_needs_revision"] as const,
    pending: ["pending"] as const,
    invalid_needs_revision: ["invalid_needs_revision"] as const,
  };

  const statuses =
    statusesByFilter[filters.status];

  return await withVerifiedActor(c, ["admin"], async (db) => {
    const conditions = [
      inArray(offers.status, statuses),
      gt(offers.expiresAt, new Date()),
    ];
    if (filters.minOfferedPricePerKg) {
      conditions.push(gte(offers.offeredPricePerKg, filters.minOfferedPricePerKg));
    }
    if (filters.maxOfferedPricePerKg) {
      conditions.push(lte(offers.offeredPricePerKg, filters.maxOfferedPricePerKg));
    }
    if (filters.minQuantityQuintals) {
      conditions.push(gte(offers.quantityKg, quintalsToKilograms(filters.minQuantityQuintals)));
    }
    if (filters.maxQuantityQuintals) {
      conditions.push(lte(offers.quantityKg, quintalsToKilograms(filters.maxQuantityQuintals)));
    }
    if (filters.minMoisturePercent) {
      conditions.push(gte(offers.moisturePercent, filters.minMoisturePercent));
    }
    if (filters.maxMoisturePercent) {
      conditions.push(lte(offers.moisturePercent, filters.maxMoisturePercent));
    }
    if (filters.minBeanCountPer100g) {
      conditions.push(gte(offers.beanCountPer100g, filters.minBeanCountPer100g));
    }
    if (filters.maxBeanCountPer100g) {
      conditions.push(lte(offers.beanCountPer100g, filters.maxBeanCountPer100g));
    }
    if (filters.readyFrom) {
      conditions.push(gte(offers.readyOn, filters.readyFrom));
    }
    if (filters.readyTo) {
      conditions.push(lte(offers.readyOn, filters.readyTo));
    }

    const rows = await db
      .select({
        id: offers.id,
        farmerPhoneNumber: user.phoneNumber,
        offeredPricePerKg: offers.offeredPricePerKg,
        basePricePerKg: dailyPrices.basePricePerKg,
        quantityKg: offers.quantityKg,
        moisturePercent: offers.moisturePercent,
        beanCountPer100g: offers.beanCountPer100g,
        readyOn: offers.readyOn,
        status: offers.status,
        submittedAt: offers.submittedAt,
        expiresAt: offers.expiresAt,
      })
      .from(offers)
      .innerJoin(farmerProfile, eq(offers.farmerId, farmerProfile.id))
      .innerJoin(user, eq(farmerProfile.authUserId, user.id))
      .innerJoin(dailyPrices, eq(offers.dailyPriceId, dailyPrices.id))
      .where(and(...conditions))
      .orderBy(desc(offers.submittedAt))
      .limit(100);

    return c.json({
      status: filters.status,
      limit: 100,
      offers: rows.map((offer) => ({
        ...offer,
        quantityQuintals: kilogramsToQuintals(offer.quantityKg),
      })),
    });
  });
});

const rejectOfferSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

routes.post("/api/admin/offers/:offerId/accept", async (c) => {
  const offerId = z.string().uuid().safeParse(c.req.param("offerId"));
  if (!offerId.success) return c.json({ error: "Invalid quote ID." }, 400);

  return withVerifiedActor(c, ["admin"], async (db, actor) => {
    const result = await db.transaction(async (tx) => {
      const [offer] = await tx
        .select()
        .from(offers)
        .where(eq(offers.id, offerId.data))
        .for("update");
      if (!offer) return { kind: "missing" as const };
      if (offer.status !== "pending") return { kind: "not_pending" as const };
      if (offer.expiresAt <= new Date()) {
        await tx.update(offers).set({ status: "expired" }).where(eq(offers.id, offer.id));
        await tx.insert(offerEvents).values({
          offerId: offer.id,
          eventType: "expired",
          oldValues: { status: offer.status },
          newValues: { status: "expired" },
          actorType: "system",
        });
        return { kind: "expired" as const };
      }

      const [deal] = await tx
        .insert(deals)
        .values({
          offerId: offer.id,
          farmerId: offer.farmerId,
          acceptedBy: actor.id,
          offeredPricePerKg: offer.offeredPricePerKg,
          quantityKg: offer.quantityKg,
          moisturePercent: offer.moisturePercent,
          beanCountPer100g: offer.beanCountPer100g,
          readyOn: offer.readyOn,
        })
        .returning();
      await tx.update(offers).set({ status: "accepted" }).where(eq(offers.id, offer.id));
      await tx.insert(offerEvents).values({
        offerId: offer.id,
        eventType: "accepted",
        oldValues: { status: offer.status },
        newValues: { status: "accepted", dealId: deal.id },
        actorType: "admin",
        actorId: actor.id,
      });
      return { kind: "accepted" as const, deal };
    });

    if (result.kind === "missing") return c.json({ error: "Quote not found." }, 404);
    if (result.kind === "not_pending") {
      return c.json({ error: "Only pending quotes can be accepted." }, 409);
    }
    if (result.kind === "expired") return c.json({ error: "This quote has expired." }, 410);
    return c.json({ deal: result.deal }, 201);
  });
});

routes.post("/api/admin/offers/:offerId/reject", async (c) => {
  const offerId = z.string().uuid().safeParse(c.req.param("offerId"));
  if (!offerId.success) return c.json({ error: "Invalid quote ID." }, 400);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON." }, 400);
  }
  const parsed = rejectOfferSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Enter a rejection reason (up to 500 characters)." }, 400);
  }

  return withVerifiedActor(c, ["admin"], async (db, actor) => {
    const result = await db.transaction(async (tx) => {
      const [offer] = await tx
        .select()
        .from(offers)
        .where(eq(offers.id, offerId.data))
        .for("update");
      if (!offer) return { kind: "missing" as const };
      if (!["pending", "invalid_needs_revision"].includes(offer.status)) {
        return { kind: "not_open" as const };
      }
      if (offer.expiresAt <= new Date()) {
        await tx.update(offers).set({ status: "expired" }).where(eq(offers.id, offer.id));
        await tx.insert(offerEvents).values({
          offerId: offer.id,
          eventType: "expired",
          oldValues: { status: offer.status },
          newValues: { status: "expired" },
          actorType: "system",
        });
        return { kind: "expired" as const };
      }

      await tx.update(offers).set({
        status: "rejected",
        rejectionReason: parsed.data.reason,
      }).where(eq(offers.id, offer.id));
      await tx.insert(offerEvents).values({
        offerId: offer.id,
        eventType: "rejected",
        oldValues: { status: offer.status },
        newValues: { status: "rejected" },
        reason: parsed.data.reason,
        actorType: "admin",
        actorId: actor.id,
      });
      return { kind: "rejected" as const };
    });
    if (result.kind === "missing") return c.json({ error: "Quote not found." }, 404);
    if (result.kind === "not_open") return c.json({ error: "This quote is no longer open." }, 409);
    if (result.kind === "expired") return c.json({ error: "This quote has expired." }, 410);
    return c.json({ status: "rejected" });
  });
});

routes.get("/api/admin/deals", async (c) =>
  withVerifiedActor(c, ["admin"], async (db) => {
    const rows = await db
      .select({
        id: deals.id,
        offerId: deals.offerId,
        farmerPhoneNumber: user.phoneNumber,
        offeredPricePerKg: deals.offeredPricePerKg,
        quantityKg: deals.quantityKg,
        moisturePercent: deals.moisturePercent,
        beanCountPer100g: deals.beanCountPer100g,
        readyOn: deals.readyOn,
        pickupLocation: deals.pickupLocation,
        pickupScheduledOn: deals.pickupScheduledOn,
        collectedOn: deals.collectedOn,
        collectedWeightKg: deals.collectedWeightKg,
        status: deals.status,
        acceptedAt: deals.acceptedAt,
      })
      .from(deals)
      .innerJoin(farmerProfile, eq(deals.farmerId, farmerProfile.id))
      .innerJoin(user, eq(farmerProfile.authUserId, user.id))
      .orderBy(desc(deals.acceptedAt))
      .limit(100);
    return c.json({
      limit: 100,
      deals: rows.map((deal) => ({
        ...deal,
        quantityQuintals: kilogramsToQuintals(deal.quantityKg),
        collectedWeightQuintals: deal.collectedWeightKg
          ? kilogramsToQuintals(deal.collectedWeightKg)
          : null,
      })),
    });
  }),
);

routes.post("/api/admin/deals/:dealId/pickup-date", async (c) => {
  const dealId = z.string().uuid().safeParse(c.req.param("dealId"));
  if (!dealId.success) return c.json({ error: "Invalid deal ID." }, 400);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON." }, 400);
  }
  const parsed = z.object({ pickupScheduledOn: calendarDateQuery }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Enter a valid pickup date in DD-MM-YYYY format." }, 400);
  }

  return withVerifiedActor(c, ["admin"], async (db, actor) => {
    const result = await db.transaction(async (tx) => {
      const [deal] = await tx
        .select({
          id: deals.id,
          offerId: deals.offerId,
          status: deals.status,
          pickupLocation: deals.pickupLocation,
          pickupScheduledOn: deals.pickupScheduledOn,
        })
        .from(deals)
        .where(eq(deals.id, dealId.data))
        .for("update");
      if (!deal) return { kind: "missing" as const };
      if (deal.status !== "open") return { kind: "closed" as const };
      if (!deal.pickupLocation) return { kind: "location_missing" as const };

      const now = new Date();
      await tx.update(deals).set({
        pickupScheduledOn: parsed.data.pickupScheduledOn,
        pickupScheduledAt: now,
        pickupScheduledBy: actor.id,
        updatedAt: now,
      }).where(eq(deals.id, deal.id));
      await tx.insert(offerEvents).values({
        offerId: deal.offerId,
        eventType: deal.pickupScheduledOn ? "pickup_date_updated" : "pickup_date_scheduled",
        oldValues: { pickupScheduledOn: deal.pickupScheduledOn },
        newValues: { pickupScheduledOn: parsed.data.pickupScheduledOn },
        actorType: "admin",
        actorId: actor.id,
      });
      return { kind: "saved" as const };
    });

    if (result.kind === "missing") return c.json({ error: "Deal not found." }, 404);
    if (result.kind === "closed") return c.json({ error: "Pickup dates can only be changed for open deals." }, 409);
    if (result.kind === "location_missing") {
      return c.json({ error: "Ask the farmer to provide a pickup location before scheduling the driver." }, 409);
    }
    return c.json({ pickupScheduledOn: parsed.data.pickupScheduledOn });
  });
});

routes.post("/api/admin/deals/:dealId/collection", async (c) => {
  const dealId = z.string().uuid().safeParse(c.req.param("dealId"));
  if (!dealId.success) return c.json({ error: "Invalid deal ID." }, 400);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON." }, 400);
  }
  const parsed = recordCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message ?? "Enter a valid collection date and weight." },
      400,
    );
  }
  // ISO dates compare correctly as strings, so this is a plain calendar comparison.
  if (parsed.data.collectedOn > getBusinessDate()) {
    return c.json({ error: "The collection date cannot be in the future." }, 400);
  }
  const collectedWeightKg = quantityToKilograms(parsed.data.quantity, parsed.data.quantityUnit);

  return withVerifiedActor(c, ["admin"], async (db, actor) => {
    const result = await db.transaction(async (tx) => {
      const [deal] = await tx
        .select({
          id: deals.id,
          offerId: deals.offerId,
          status: deals.status,
          pickupLocation: deals.pickupLocation,
          collectedOn: deals.collectedOn,
          collectedWeightKg: deals.collectedWeightKg,
        })
        .from(deals)
        .where(eq(deals.id, dealId.data))
        .for("update");
      if (!deal) return { kind: "missing" as const };
      if (deal.status !== "open") return { kind: "closed" as const };
      if (!deal.pickupLocation) return { kind: "location_missing" as const };

      const now = new Date();
      // Status stays "open": inspection, partial acceptance, and payment come after collection.
      await tx.update(deals).set({
        collectedOn: parsed.data.collectedOn,
        collectedWeightKg,
        collectionRecordedAt: now,
        collectionRecordedBy: actor.id,
        updatedAt: now,
      }).where(eq(deals.id, deal.id));
      await tx.insert(offerEvents).values({
        offerId: deal.offerId,
        eventType: deal.collectedOn ? "pickup_collection_updated" : "pickup_collected",
        oldValues: {
          collectedOn: deal.collectedOn,
          collectedWeightKg: deal.collectedWeightKg,
        },
        newValues: {
          collectedOn: parsed.data.collectedOn,
          collectedWeightKg,
          enteredQuantity: parsed.data.quantity,
          enteredUnit: parsed.data.quantityUnit,
        },
        actorType: "admin",
        actorId: actor.id,
      });
      return { kind: "saved" as const };
    });

    if (result.kind === "missing") return c.json({ error: "Deal not found." }, 404);
    if (result.kind === "closed") {
      return c.json({ error: "Collections can only be recorded for open deals." }, 409);
    }
    if (result.kind === "location_missing") {
      return c.json({ error: "This deal has no pickup location yet, so a collection cannot be recorded." }, 409);
    }
    return c.json({
      collectedOn: parsed.data.collectedOn,
      collectedWeightKg,
      collectedWeightQuintals: kilogramsToQuintals(collectedWeightKg),
    });
  });
});

export default routes;
