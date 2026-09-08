/**
 * The rules that decide whether a provider transaction may fulfil a payment.
 *
 * Deliberately pure: no database, no network, no environment. Every branch here
 * is directly unit-tested, because this is the function standing between a
 * student's receipt and a forged or mismatched transaction.
 */

import type { PaystackTransaction } from "@/lib/paystack/types";

export type ExpectedPayment = {
  reference: string;
  amount: number;
  currency: string;
};

export type ProviderCheckFailure =
  | "REFERENCE_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "NOT_SUCCESSFUL";

export type ProviderCheckResult =
  | { ok: true; transaction: PaystackTransaction }
  | { ok: false; reason: ProviderCheckFailure; detail: Record<string, unknown> };

/**
 * All of these must hold before a payment is allowed to become SUCCESS:
 *  1. the provider's reference is the one we generated;
 *  2. the provider says the transaction succeeded;
 *  3. the amount matches the stored expected amount *exactly* (minor units);
 *  4. the currency matches.
 */
export function checkProviderTransaction(
  expected: ExpectedPayment,
  transaction: PaystackTransaction | null | undefined,
): ProviderCheckResult {
  if (!transaction) {
    return { ok: false, reason: "NOT_SUCCESSFUL", detail: { providerStatus: "missing" } };
  }

  const providerReference = String(transaction.reference ?? "").trim();
  if (providerReference.toUpperCase() !== expected.reference.toUpperCase()) {
    return {
      ok: false,
      reason: "REFERENCE_MISMATCH",
      detail: { expected: expected.reference, received: providerReference },
    };
  }

  if (String(transaction.status ?? "").toLowerCase() !== "success") {
    return {
      ok: false,
      reason: "NOT_SUCCESSFUL",
      detail: { providerStatus: transaction.status ?? null },
    };
  }

  // Amounts are integers in minor units on both sides. Anything that is not a
  // safe integer is treated as a mismatch rather than coerced.
  const providerAmount = transaction.amount;
  if (!Number.isSafeInteger(providerAmount) || providerAmount !== expected.amount) {
    return {
      ok: false,
      reason: "AMOUNT_MISMATCH",
      detail: { expected: expected.amount, received: providerAmount },
    };
  }

  const providerCurrency = String(transaction.currency ?? "").toUpperCase();
  if (providerCurrency !== expected.currency.toUpperCase()) {
    return {
      ok: false,
      reason: "CURRENCY_MISMATCH",
      detail: { expected: expected.currency, received: providerCurrency },
    };
  }

  return { ok: true, transaction };
}

/** Paystack reports the channel in two places depending on the endpoint. */
export function resolveChannel(transaction: PaystackTransaction): string | null {
  const channel = transaction.channel ?? transaction.authorization?.channel ?? null;
  return channel ? String(channel).slice(0, 30) : null;
}

export function resolvePaidAt(transaction: PaystackTransaction): Date {
  const raw = transaction.paid_at ?? transaction.created_at;
  if (!raw) return new Date();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
