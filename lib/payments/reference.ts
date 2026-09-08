import { randomInt } from "node:crypto";

/**
 * Payment references and receipt numbers.
 *
 * References are generated on the server only — the browser never chooses one —
 * and the database holds a unique constraint on the column, so a collision
 * fails loudly rather than merging two students' payments.
 */

/**
 * Crockford-style alphabet: no I, L, O or U. A student reading a reference off
 * a phone screen to a finance officer cannot confuse 0 with O or 1 with I.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const SUFFIX_LENGTH = 8;

export const REFERENCE_PATTERN = /^COLBIOS-\d{4}-[0-9A-HJ-NP-TV-Z]{8}$/;
export const RECEIPT_NUMBER_PATTERN = /^COLBIOS-REC-\d{4}-\d{6}$/;

/** Cryptographically random suffix — not derived from time or a counter. */
function randomSuffix(length = SUFFIX_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

/**
 * COLBIOS-2026-7F3KQ9AB
 *
 * The year comes from the academic session's starting year (2026/2027 -> 2026)
 * so a reference is self-describing, and falls back to the current year when a
 * session name is not in that shape.
 */
export function generatePaymentReference(sessionName: string, now: Date = new Date()): string {
  const year = sessionYear(sessionName, now);
  return `COLBIOS-${year}-${randomSuffix()}`;
}

export function sessionYear(sessionName: string, now: Date = new Date()): number {
  const match = /^(\d{4})\s*\/\s*\d{4}$/.exec(sessionName.trim());
  return match ? Number(match[1]) : now.getUTCFullYear();
}

/** COLBIOS-REC-2026-000001 — the sequence value comes from an atomic counter. */
export function formatReceiptNumber(year: number, sequence: number): string {
  return `COLBIOS-REC-${year}-${sequence.toString().padStart(6, "0")}`;
}

export function isValidReference(value: string): boolean {
  return REFERENCE_PATTERN.test(value);
}
