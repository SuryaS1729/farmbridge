import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb } from "./db/client";
import { createAuth } from "./auth";
import adminRoutes from "./routes/admin";
import offerRoutes from "./routes/offers";
import priceRoutes from "./routes/prices";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.route("/", priceRoutes);
app.route("/", offerRoutes);
app.route("/", adminRoutes);

app.get("/", (c) => c.text("Hello Sahithi!"));

app.all("/api/auth/*", async (c) => {
  const { client, db } = createDb(c.env.HYPERDRIVE.connectionString);

  try {
    await client.connect();

    const auth = createAuth(db, {
      secret: c.env.BETTER_AUTH_SECRET,
      baseURL: c.env.BETTER_AUTH_URL,
    });

    return await auth.handler(c.req.raw);
  } catch (error) {
    console.error("Better Auth request failed", error);
    return c.json({ error: "Authentication request failed" }, 500);
  } finally {
    await client.end();
  }
});

app.get("/health/db", async (c) => {
  const { client, db } = createDb(c.env.HYPERDRIVE.connectionString);

  try {
    await client.connect();
    await db.execute(sql`select 1`);

    return c.json({ ok: true, database: "connected" });
  } catch (error) {
    console.error("Database connection failed", error);
    return c.json({ ok: false, database: "disconnected" }, 500);
  } finally {
    await client.end();
  }
});

export default app;
