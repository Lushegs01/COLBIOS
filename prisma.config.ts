import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 moves the connection URL out of schema.prisma. The URL is only read
 * here (CLI/migration time) and by the runtime adapter in lib/db/prisma.ts —
 * it is never bundled into anything that reaches the browser.
 *
 * DIRECT_DATABASE_URL is optional and only matters for hosted Postgres that
 * fronts the database with a connection pooler (Supabase, Neon, PgBouncer):
 * migrations need the direct, non-pooled connection.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
