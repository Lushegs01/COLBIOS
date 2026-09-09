import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 moves the connection URL out of schema.prisma. The URL is only read
 * here (CLI/migration time) and by the runtime adapter in lib/db/prisma.ts —
 * it is never bundled into anything that reaches the browser.
 *
 * The URL is read with plain `process.env` rather than Prisma's `env()` helper,
 * and that is deliberate: `env()` throws while this config file is *loaded*,
 * which breaks every Prisma command including `prisma generate`. Generate needs
 * only the schema, and it runs during `postinstall` and `next build` on a
 * deployment platform where the database credentials may not be present yet —
 * so a missing URL must not fail the build. Commands that genuinely need a
 * connection (`migrate`, `db push`, `studio`) still fail, with Prisma's own
 * message naming the missing datasource URL.
 *
 * SHADOW_DATABASE_URL is optional and only matters for hosted Postgres that
 * fronts the database with a connection pooler (Supabase, Neon, PgBouncer):
 * migrations need the direct, non-pooled connection.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
