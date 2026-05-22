import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

let sqlClient: ReturnType<typeof postgres> | undefined;

export function getDb() {
  const connectionString =
    process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Missing SUPABASE_DB_URL or DATABASE_URL.");
  }

  sqlClient ??= postgres(connectionString, {
    prepare: false,
  });

  return drizzle(sqlClient, { schema });
}
