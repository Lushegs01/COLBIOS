/**
 * The payment state machine.
 *
 *   PENDING ──► SUCCESS ──► REVERSED
 *      │           └─────► REFUNDED
 *      ├──► FAILED
 *      └──► ABANDONED
 *
 * Every status change in the system goes through `assertTransition`, so an
 * out-of-order webhook cannot walk a payment backwards from SUCCESS to PENDING,
 * and a failed payment cannot silently become successful.
 */

export const PAYMENT_STATUSES = [
  "PENDING",
  "SUCCESS",
  "FAILED",
  "ABANDONED",
  "REVERSED",
  "REFUNDED",
] as const;

export type PaymentStatusValue = (typeof PAYMENT_STATUSES)[number];

const ALLOWED: Record<PaymentStatusValue, readonly PaymentStatusValue[]> = {
  PENDING: ["SUCCESS", "FAILED", "ABANDONED"],
  SUCCESS: ["REVERSED", "REFUNDED"],
  FAILED: ["SUCCESS"], // a retry on the same reference can still succeed at the provider
  ABANDONED: ["SUCCESS"], // ditto: an abandoned checkout that later completes
  REVERSED: [],
  REFUNDED: [],
};

/** Statuses that mean "the student has paid and owes nothing further". */
export const FULFILLED_STATUSES: readonly PaymentStatusValue[] = ["SUCCESS", "REVERSED", "REFUNDED"];

/** Statuses that block a new payment attempt for the same student/fee/session. */
export const BLOCKING_STATUSES: readonly PaymentStatusValue[] = ["SUCCESS"];

export function canTransition(from: PaymentStatusValue, to: PaymentStatusValue): boolean {
  if (from === to) return true; // idempotent re-application is always allowed
  return ALLOWED[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: PaymentStatusValue,
    readonly to: PaymentStatusValue,
  ) {
    super(`A payment cannot move from ${from} to ${to}.`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: PaymentStatusValue, to: PaymentStatusValue): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

export function isTerminal(status: PaymentStatusValue): boolean {
  return ALLOWED[status].length === 0;
}

/** Map a Paystack transaction status onto ours. Unknown values stay PENDING. */
export function fromProviderStatus(providerStatus: string): PaymentStatusValue {
  switch (providerStatus.toLowerCase()) {
    case "success":
      return "SUCCESS";
    case "failed":
      return "FAILED";
    case "abandoned":
      return "ABANDONED";
    case "reversed":
      return "REVERSED";
    case "refunded":
      return "REFUNDED";
    default:
      return "PENDING";
  }
}

export const STATUS_LABELS: Record<PaymentStatusValue, string> = {
  PENDING: "Pending",
  SUCCESS: "Successful",
  FAILED: "Failed",
  ABANDONED: "Abandoned",
  REVERSED: "Reversed",
  REFUNDED: "Refunded",
};
