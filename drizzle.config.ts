import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing SUPABASE_DB_URL or DATABASE_URL.");
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
