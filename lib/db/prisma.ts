import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";
import { serverEnv } from "@/lib/env";

/**
 * A single PrismaClient per process.
 *
 * Next.js dev-server hot reloads would otherwise open a new connection pool on
 * every edit and exhaust the database's connection limit, so the instance is
 * cached on globalThis outside production.
 */
declare global {
  var __colbiosPrisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: serverEnv.databaseUrl });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const prisma: PrismaClient =
  globalThis.__colbiosPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__colbiosPrisma = prisma;
}

export type { PrismaClient };
