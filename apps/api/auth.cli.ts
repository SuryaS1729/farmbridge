import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { createAuth } from "./src/auth";

// The schema generator needs a Drizzle instance, but does not connect to this URL.
const client = new Client({
  connectionString: "postgres://schema:placeholder@127.0.0.1:5432/schema",
});
const db = drizzle(client);

export const auth = createAuth(db, {
  secret: "schema-generation-placeholder-secret-only",
  baseURL: "http://localhost:8787",
});
