import type { Context } from "hono";

import { createAuth } from "../auth";
import { createDb } from "../db/client";

type ApiContext = Context<{ Bindings: CloudflareBindings }>;
type AuthDatabase = ReturnType<typeof createDb>["db"];
type Role = "farmer" | "admin";

export type Actor = {
  id: string;
  role: Role;
  phoneNumber: string | null;
};

export async function withVerifiedActor(
  c: ApiContext,
  allowedRoles: readonly Role[],
  handler: (db: AuthDatabase, actor: Actor) => Promise<Response>,
): Promise<Response> {
  const { client, db } = createDb(c.env.HYPERDRIVE.connectionString);

  try {
    await client.connect();

    const auth = createAuth(db, {
      secret: c.env.BETTER_AUTH_SECRET,
      baseURL: c.env.BETTER_AUTH_URL,
    });
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      return c.json({ error: "Sign in is required." }, 401);
    }

    if (session.user.phoneNumberVerified !== true) {
      return c.json({ error: "A verified phone number is required." }, 403);
    }

    if (!allowedRoles.includes(session.user.role)) {
      return c.json({ error: "You do not have permission for this action." }, 403);
    }

    return await handler(db, {
      id: session.user.id,
      role: session.user.role,
      phoneNumber: session.user.phoneNumber ?? null,
    });
  } catch (error) {
    console.error("Authenticated API request failed", error);
    return c.json({ error: "The request could not be completed." }, 500);
  } finally {
    await client.end();
  }
}
