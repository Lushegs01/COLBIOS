import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";
import { serverEnv } from "@/lib/env";

/**
 * The database client.
 *
 * Created **lazily**, on the first query rather than when this module is
 * imported. That matters for two reasons:
 *
 *  - `next build` imports every route module to collect page data. An eager
 *    client would read DATABASE_URL at that moment and fail the whole build on
 *    a deployment platform where the database credentials are not present yet.
 *    A build needs the schema, never a connection.
 *  - A missing or malformed URL then surfaces as a clean error on the request
 *    that actually needs the database, instead of an opaque module-load crash.
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
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

let client: PrismaClient | undefined;

function getClient(): PrismaClient {
  client ??= globalThis.__colbiosPrisma ?? createPrismaClient();
  if (process.env.NODE_ENV !== "production") globalThis.__colbiosPrisma = client;
  return client;
}

/**
 * A stand-in that behaves exactly like a PrismaClient but builds the real one
 * on first use. Methods are bound to the client because Prisma's own
 * implementations rely on `this`.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const instance = getClient();
    const value = Reflect.get(instance, property, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
  set(_target, property, value) {
    return Reflect.set(getClient(), property, value);
  },
  has(_target, property) {
    return Reflect.has(getClient(), property);
  },
  getPrototypeOf() {
    return Reflect.getPrototypeOf(getClient());
  },
  ownKeys() {
    return Reflect.ownKeys(getClient());
  },
  getOwnPropertyDescriptor(_target, property) {
    const descriptor = Reflect.getOwnPropertyDescriptor(getClient(), property);
    // A proxy may only report a property as non-configurable if the target has
    // it too, and the target here is an empty object.
    return descriptor ? { ...descriptor, configurable: true } : undefined;
  },
});

export type { PrismaClient };
