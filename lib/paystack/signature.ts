import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Paystack signs every webhook with HMAC-SHA512 over the *raw* request body,
 * keyed with the account's secret key, and sends the hex digest in the
 * `x-paystack-signature` header.
 *
 * Two details matter and are easy to get wrong:
 *  1. The digest must be computed over the exact bytes received. Re-serialising
 *     `await request.json()` changes key order and whitespace and will never
 *     match.
 *  2. The comparison must be constant-time, or the endpoint leaks the expected
 *     signature one byte at a time.
 */

export const PAYSTACK_SIGNATURE_HEADER = "x-paystack-signature";

export function computeWebhookSignature(rawBody: string, secretKey: string): string {
  return createHmac("sha512", secretKey).update(rawBody, "utf8").digest("hex");
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secretKey: string,
): boolean {
  if (!signature || typeof signature !== "string") return false;

  const expected = computeWebhookSignature(rawBody, secretKey);
  const provided = signature.trim().toLowerCase();

  // Length check first: timingSafeEqual throws on mismatched buffer lengths,
  // and the length of a SHA-512 hex digest is not a secret.
  if (provided.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}
