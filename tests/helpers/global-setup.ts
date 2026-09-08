import { execSync } from "node:child_process";
import { config as loadEnv } from "dotenv";

/**
 * Prepares the test database once per run.
 *
 * Migrations are applied with the real Prisma CLI rather than `db push`, so the
 * schema under test is byte-for-byte the schema that will be deployed —
 * including the hand-written partial unique indexes the payment logic relies
 * on.
 */
export default function setup() {
  loadEnv({ path: ".env.test", quiet: true });
  loadEnv({ path: ".env", override: false, quiet: true });

  const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "No TEST_DATABASE_URL or DATABASE_URL set. Point one at a database you are happy to wipe.",
    );
  }

  if (!/test/i.test(databaseUrl)) {
    throw new Error(
      `Refusing to run tests against ${redactUrl(databaseUrl)} — the database name must contain "test".`,
    );
  }

  process.env.DATABASE_URL = databaseUrl;

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return "the configured database";
  }
}
