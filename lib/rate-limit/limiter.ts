import "server-only";

import { createHmac } from "node:crypto";

import { prisma } from "@/lib/db/prisma";
import { serverEnv } from "@/lib/env";
import { describeError, logger } from "@/lib/logger";

/**
 * Fixed-window rate limiting, backed by Postgres.
 *
 * In-memory counters are useless on Vercel: each serverless instance would keep
 * its own, and an attacker simply spreads requests across instances. The
 * counter therefore lives in the database, incremented atomically with
 * INSERT … ON CONFLICT DO UPDATE, which is a single round trip and safe under
 * concurrency.
 *
 * Identifiers are stored as a keyed hash, never as raw IP addresses.
 */

export type RateLimitRule = {
  /** Namespace, e.g. "payments:initialize". */
  bucket: string;
  /** Maximum requests allowed inside the window. */
  limit: number;
  windowMs: number;
};

export const RATE_LIMITS = {
  /** Starting a checkout: expensive for us and for Paystack. */
  paymentInitialize: { bucket: "payments:initialize", limit: 5, windowMs: 10 * 60 * 1000 },
  /** Quoting is cheap but is also the matric-number probing surface. */
  paymentQuote: { bucket: "payments:quote", limit: 20, windowMs: 10 * 60 * 1000 },
  /** Verification is a provider round trip; a refresh loop must not hammer it. */
  paymentVerify: { bucket: "payments:verify", limit: 20, windowMs: 5 * 60 * 1000 },
  /** Public receipt/verification lookups — the enumeration surface. */
  publicLookup: { bucket: "public:lookup", limit: 30, windowMs: 5 * 60 * 1000 },
  /** Admin sign-in attempts, per IP. */
  adminLogin: { bucket: "admin:login", limit: 8, windowMs: 15 * 60 * 1000 },
  /** Admin sign-in attempts, per account — blunts credential stuffing. */
  adminLoginAccount: { bucket: "admin:login:account", limit: 10, windowMs: 15 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Seconds until the current window ends. */
  retryAfterSeconds: number;
};

/** Hash the identifier so the database never holds a raw IP address. */
function hashIdentifier(identifier: string): string {
  let key: string;
  try {
    key = serverEnv.authSecret;
  } catch {
    key = "colbios-rate-limit-fallback";
  }
  return createHmac("sha256", key).update(identifier).digest("base64url").slice(0, 24);
}

export async function checkRateLimit(
  rule: RateLimitRule,
  identifier: string,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / rule.windowMs) * rule.windowMs;
  const expiresAt = new Date(windowStart + rule.windowMs);
  const id = `${rule.bucket}:${hashIdentifier(identifier)}:${windowStart}`;
  const retryAfterSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000));

  try {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "RateLimitBucket" ("id", "bucket", "count", "expiresAt")
      VALUES (${id}, ${rule.bucket}, 1, ${expiresAt})
      ON CONFLICT ("id")
      DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
      RETURNING "count"
    `;

    const count = rows[0]?.count ?? 1;
    const allowed = count <= rule.limit;

    if (!allowed) {
      logger.warn("rate_limited", { bucket: rule.bucket, count, limit: rule.limit });
    }

    // Opportunistic cleanup — roughly one request in fifty pays for it.
    if (Math.random() < 0.02) void cleanupExpiredBuckets();

    return {
      allowed,
      remaining: Math.max(0, rule.limit - count),
      limit: rule.limit,
      retryAfterSeconds,
    };
  } catch (error) {
    // A rate-limiter outage must not become an application outage. Anything
    // that actually touches money re-checks its own invariants in the database.
    logger.error("unexpected_error", { scope: "rate_limit", ...describeError(error) });
    return { allowed: true, remaining: rule.limit, limit: rule.limit, retryAfterSeconds };
  }
}

async function cleanupExpiredBuckets(): Promise<void> {
  try {
    await prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch {
    // Best effort only.
  }
}

/**
 * Client identity for rate limiting. On Vercel `x-forwarded-for` is set by the
 * platform edge and cannot be spoofed by the client; locally it may be absent,
 * in which case every caller shares one bucket, which is fine for development.
 */
export function clientIdentifier(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** Standard headers so clients can back off politely. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "Retry-After": String(result.retryAfterSeconds),
  };
}
