import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";

/**
 * A Prisma client for command-line scripts (seed, admin bootstrap).
 *
 * Deliberately separate from lib/db/prisma.ts: that module is `server-only`
 * and belongs to the Next.js runtime. Scripts get their own short-lived client
 * that they close when they are done.
 */
export function createScriptClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
