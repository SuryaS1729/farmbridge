import { and, asc, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";

import { farmerAddresses, farmerProfile, user } from "../db/schema";
import {
  addressColumns,
  createFarmerAddress,
  ensureFarmerProfileId,
  promoteNewestAddress,
} from "../lib/farmer-addresses";
import { withVerifiedActor } from "../lib/with-verified-actor";
import {
  createAddressSchema,
  MAX_ADDRESSES_PER_FARMER,
  saveAddressSchema,
} from "../validation/farmer-address";
import { saveFarmerProfileSchema } from "../validation/farmer-profile";

const routes = new Hono<{ Bindings: CloudflareBindings }>();
type ApiContext = Context<{ Bindings: CloudflareBindings }>;

const profileColumns = {
  aadhaarName: farmerProfile.aadhaarName,
  village: farmerProfile.village,
  mandal: farmerProfile.mandal,
  farmSizeAcres: farmerProfile.farmSizeAcres,
  cocoaTreeCount: farmerProfile.cocoaTreeCount,
  onboardedAt: farmerProfile.onboardedAt,
};

const addressIdSchema = z.string().uuid();

async function readJson(c: ApiContext) {
  return c.req.json().catch(() => null);
}

function validationError(c: ApiContext, error: z.ZodError, fallback: string) {
  return c.json(
    {
      error: error.issues[0]?.message ?? fallback,
      fields: error.flatten().fieldErrors,
    },
    400,
  );
}

routes.get("/api/farmer/profile", (c) =>
  withVerifiedActor(c, ["farmer"], async (db, actor) => {
    const [profile] = await db
      .select(profileColumns)
      .from(farmerProfile)
      .where(eq(farmerProfile.authUserId, actor.id))
      .limit(1);

    return c.json({
      profile: profile ?? null,
      onboarded: Boolean(profile?.onboardedAt),
    });
  }),
);

routes.post("/api/farmer/profile", (c) =>
  withVerifiedActor(c, ["farmer"], async (db, actor) => {
    const parsed = saveFarmerProfileSchema.safeParse(await readJson(c));
    if (!parsed.success) {
      return validationError(c, parsed.error, "Check the farm details.");
    }

    const details = parsed.data;
    const now = new Date();

    const profile = await db.transaction(async (tx) => {
      const [saved] = await tx
        .insert(farmerProfile)
        .values({ authUserId: actor.id, ...details, onboardedAt: now })
        .onConflictDoUpdate({
          target: farmerProfile.authUserId,
          // Keep the first onboarding time when details are edited later.
          set: {
            ...details,
            onboardedAt: sql`coalesce(${farmerProfile.onboardedAt}, ${now})`,
            updatedAt: now,
          },
        })
        .returning(profileColumns);

      // Replace the phone-number placeholder name set at sign-up.
      await tx
        .update(user)
        .set({ name: details.aadhaarName })
        .where(eq(user.id, actor.id));

      return saved;
    });

    return c.json({ profile, onboarded: true });
  }),
);

routes.get("/api/farmer/addresses", (c) =>
  withVerifiedActor(c, ["farmer"], async (db, actor) => {
    const addresses = await db
      .select(addressColumns)
      .from(farmerAddresses)
      .innerJoin(farmerProfile, eq(farmerAddresses.farmerId, farmerProfile.id))
      .where(eq(farmerProfile.authUserId, actor.id))
      .orderBy(desc(farmerAddresses.isDefault), asc(farmerAddresses.createdAt));

    return c.json({ addresses });
  }),
);

routes.post("/api/farmer/addresses", (c) =>
  withVerifiedActor(c, ["farmer"], async (db, actor) => {
    const parsed = createAddressSchema.safeParse(await readJson(c));
    if (!parsed.success) {
      return validationError(c, parsed.error, "Check the address.");
    }

    const address = await db.transaction(async (tx) => {
      const farmerId = await ensureFarmerProfileId(tx, actor.id);
      return createFarmerAddress(tx, farmerId, parsed.data);
    });

    if (!address) {
      return c.json(
        { error: `You can save up to ${MAX_ADDRESSES_PER_FARMER} addresses. Delete one first.` },
        409,
      );
    }
    return c.json({ address }, 201);
  }),
);

routes.patch("/api/farmer/addresses/:addressId", (c) =>
  withVerifiedActor(c, ["farmer"], async (db, actor) => {
    const addressId = addressIdSchema.safeParse(c.req.param("addressId"));
    if (!addressId.success) return c.json({ error: "Invalid address ID." }, 400);

    const parsed = saveAddressSchema.safeParse(await readJson(c));
    if (!parsed.success) {
      return validationError(c, parsed.error, "Check the address.");
    }

    const [address] = await db
      .update(farmerAddresses)
      .set({ label: parsed.data.label, address: parsed.data.address })
      .where(
        and(
          eq(farmerAddresses.id, addressId.data),
          sql`${farmerAddresses.farmerId} = (select ${farmerProfile.id} from ${farmerProfile} where ${farmerProfile.authUserId} = ${actor.id})`,
        ),
      )
      .returning(addressColumns);

    if (!address) return c.json({ error: "Address not found." }, 404);
    return c.json({ address });
  }),
);

routes.post("/api/farmer/addresses/:addressId/default", (c) =>
  withVerifiedActor(c, ["farmer"], async (db, actor) => {
    const addressId = addressIdSchema.safeParse(c.req.param("addressId"));
    if (!addressId.success) return c.json({ error: "Invalid address ID." }, 400);

    const found = await db.transaction(async (tx) => {
      const [target] = await tx
        .select({ id: farmerAddresses.id, farmerId: farmerAddresses.farmerId })
        .from(farmerAddresses)
        .innerJoin(farmerProfile, eq(farmerAddresses.farmerId, farmerProfile.id))
        .where(and(eq(farmerAddresses.id, addressId.data), eq(farmerProfile.authUserId, actor.id)))
        .for("update");
      if (!target) return false;

      await tx
        .update(farmerAddresses)
        .set({ isDefault: false })
        .where(and(eq(farmerAddresses.farmerId, target.farmerId), eq(farmerAddresses.isDefault, true)));
      await tx
        .update(farmerAddresses)
        .set({ isDefault: true })
        .where(eq(farmerAddresses.id, target.id));
      return true;
    });

    if (!found) return c.json({ error: "Address not found." }, 404);
    return c.json({ id: addressId.data, isDefault: true });
  }),
);

routes.delete("/api/farmer/addresses/:addressId", (c) =>
  withVerifiedActor(c, ["farmer"], async (db, actor) => {
    const addressId = addressIdSchema.safeParse(c.req.param("addressId"));
    if (!addressId.success) return c.json({ error: "Invalid address ID." }, 400);

    // Quotes and deals keep their own copy of the address, so deleting a
    // saved address never changes where an existing pickup goes.
    const found = await db.transaction(async (tx) => {
      const [target] = await tx
        .select({
          id: farmerAddresses.id,
          farmerId: farmerAddresses.farmerId,
          isDefault: farmerAddresses.isDefault,
        })
        .from(farmerAddresses)
        .innerJoin(farmerProfile, eq(farmerAddresses.farmerId, farmerProfile.id))
        .where(and(eq(farmerAddresses.id, addressId.data), eq(farmerProfile.authUserId, actor.id)))
        .for("update");
      if (!target) return false;

      await tx.delete(farmerAddresses).where(eq(farmerAddresses.id, target.id));
      if (target.isDefault) {
        await promoteNewestAddress(tx, target.farmerId);
      }
      return true;
    });

    if (!found) return c.json({ error: "Address not found." }, 404);
    return c.json({ id: addressId.data, deleted: true });
  }),
);

export default routes;
