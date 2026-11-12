import { and, eq, lt } from "drizzle-orm";
import { Hono } from "hono";

import { getBusinessDate } from "../lib/business-date";
import { withVerifiedActor } from "../lib/with-verified-actor";
import {
  decimalToTenThousandths,
  kilogramPriceToQuintalPrice,
  publishDailyPriceSchema,
  quintalPriceToKilogramPrice,
} from "../validation/quotes";
import { commodities, dailyPrices, offers, priceRevisions } from "../db/schema";

const routes = new Hono<{ Bindings: CloudflareBindings }>();

routes.get("/api/prices/today", (c) =>
  withVerifiedActor(c, ["farmer", "admin"], async (db) => {
    const businessDate = getBusinessDate();
    const [price] = await db
      .select({
        businessDate: dailyPrices.businessDate,
        basePricePerKg: dailyPrices.basePricePerKg,
        basePricePerQuintal: dailyPrices.basePricePerKg,
        currency: dailyPrices.currency,
      })
      .from(dailyPrices)
      .innerJoin(commodities, eq(dailyPrices.commodityId, commodities.id))
      .where(
        and(
          eq(commodities.name, "Cocoa"),
          eq(dailyPrices.businessDate, businessDate),
          eq(dailyPrices.status, "published"),
        ),
      )
      .limit(1);

    return c.json({
      businessDate,
      price: price
        ? {
            ...price,
            basePricePerQuintal: kilogramPriceToQuintalPrice(price.basePricePerQuintal),
          }
        : null,
    });
  }),
);

routes.post("/api/admin/prices/today", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON." }, 400);
  }

  const parsed = publishDailyPriceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid price.", fields: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  return withVerifiedActor(c, ["admin"], async (db, actor) => {
    const businessDate = getBusinessDate();
    const basePricePerKg = quintalPriceToKilogramPrice(
      parsed.data.basePricePerQuintal,
    );
    const result = await db.transaction(async (tx) => {
      const [cocoa] = await tx
        .select({ id: commodities.id })
        .from(commodities)
        .where(and(eq(commodities.name, "Cocoa"), eq(commodities.isActive, true)))
        .limit(1);

      if (!cocoa) {
        return { kind: "cocoa_missing" as const };
      }

      const [existing] = await tx
        .select()
        .from(dailyPrices)
        .where(
          and(
            eq(dailyPrices.commodityId, cocoa.id),
            eq(dailyPrices.businessDate, businessDate),
          ),
        )
        .for("update");

      const now = new Date();
      const oldPrice = existing?.basePricePerKg ?? null;
      const [price] = existing
        ? await tx
            .update(dailyPrices)
            .set({
              basePricePerKg,
              status: "published",
              publishedAt: now,
              publishedBy: actor.id,
              updatedAt: now,
            })
            .where(eq(dailyPrices.id, existing.id))
            .returning()
        : await tx
            .insert(dailyPrices)
            .values({
              commodityId: cocoa.id,
              businessDate,
              basePricePerKg,
              status: "published",
              publishedAt: now,
              publishedBy: actor.id,
            })
            .returning();

      const changed =
        oldPrice === null ||
        decimalToTenThousandths(oldPrice) !== decimalToTenThousandths(basePricePerKg);

      if (changed) {
        await tx.insert(priceRevisions).values({
          dailyPriceId: price.id,
          oldPricePerKg: oldPrice,
          newPricePerKg: basePricePerKg,
          changedBy: actor.id,
        });
      }

      if (
        oldPrice !== null &&
        decimalToTenThousandths(basePricePerKg) > decimalToTenThousandths(oldPrice)
      ) {
        await tx
          .update(offers)
          .set({ status: "invalid_needs_revision", updatedAt: now })
          .where(
            and(
              eq(offers.dailyPriceId, price.id),
              eq(offers.status, "pending"),
              lt(offers.offeredPricePerKg, basePricePerKg),
            ),
          );
      }

      return { kind: "published" as const, price };
    });

    if (result.kind === "cocoa_missing") {
      return c.json({ error: "The Cocoa commodity has not been seeded." }, 500);
    }

    return c.json({ price: result.price });
  });
});

export default routes;
