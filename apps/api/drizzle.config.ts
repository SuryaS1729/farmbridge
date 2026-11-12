import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { fileURLToPath, URL } from "node:url";

loadEnv({
  path: fileURLToPath(new URL("../../.env.local", import.meta.url)),
});

const databaseUrl = process.env.DATABASE_URL_UNPOOLED;

if (!databaseUrl) {
  throw new Error("DATABASE_URL_UNPOOLED is missing from the root .env.local");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
