import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

export function createDb(connectionString: string) {
  const client = new Client({ connectionString });
  const db = drizzle(client);

  return { client, db };
}
