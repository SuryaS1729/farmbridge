import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { farmerProfile, user } from "../db/schema";
import { withVerifiedActor } from "../lib/with-verified-actor";
import { saveFarmerProfileSchema } from "../validation/farmer-profile";

const routes = new Hono<{ Bindings: CloudflareBindings }>();

const profileColumns = {
  aadhaarName: farmerProfile.aadhaarName,
  village: farmerProfile.village,
  mandal: farmerProfile.mandal,
  farmSizeAcres: farmerProfile.farmSizeAcres,
  cocoaTreeCount: farmerProfile.cocoaTreeCount,
  onboardedAt: farmerProfile.onboardedAt,
};

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
    const body = await c.req.json().catch(() => null);
    const parsed = saveFarmerProfileSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          error: parsed.error.issues[0]?.message ?? "Check the farm details.",
          fields: parsed.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const details = parsed.data;
    const now = new Date();

    const profile = await db.transaction(async (tx) => {
      const [saved] = await tx
        .insert(farmerProfile)
        .values({ authUserId: actor.id, ...details, onboardedAt: now })
        .onConflictDoUpdate({
          target: farmerProfile.authUserId,
          set: { ...details, onboardedAt: now, updatedAt: now },
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

export default routes;
