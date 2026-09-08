import "server-only";

import { prisma } from "@/lib/db/prisma";
import { absoluteUrl } from "@/lib/env";
import { AppError } from "@/lib/http/api";
import { levelLabel, type LevelCode } from "@/lib/format/level";
import { isValidChargeAmount } from "@/lib/format/money";
import { describeError, logger } from "@/lib/logger";
import { paystack } from "@/lib/paystack/client";
import type { PaystackTransaction } from "@/lib/paystack/types";
import { nextReceiptNumber } from "@/lib/receipts/number";
import type { Payment, Prisma, Receipt } from "@/lib/generated/prisma/client";

import {
  requireActiveDepartment,
  requireActiveFee,
  requireActiveSession,
} from "./config";
import { generatePaymentReference, sessionYear } from "./reference";
import { assertTransition, canTransition, type PaymentStatusValue } from "./state";
import {
  checkProviderTransaction,
  resolveChannel,
  resolvePaidAt,
  type ProviderCheckFailure,
} from "./verification";

/**
 * The payment lifecycle.
 *
 * Three rules hold everywhere in this file:
 *  1. The amount is read from the database, never from the caller.
 *  2. A payment becomes SUCCESS only after Paystack itself has been asked, and
 *     only inside a transaction that locks the payment row.
 *  3. Fulfilment is idempotent — the same transaction arriving twice (webhook
 *     retry, callback + webhook, a refreshed success page) produces one
 *     receipt, one status change and one email.
 */

/** How long a still-unpaid checkout attempt may be reused before we start a new one. */
const PENDING_REUSE_WINDOW_MS = 30 * 60 * 1000;

export type StudentSubmission = {
  fullName: string;
  matricNumber: string;
  matricNormal: string;
  email: string;
  departmentId: string;
  level: LevelCode;
};

export type PaymentQuote = {
  fullName: string;
  matricNumber: string;
  email: string;
  department: { id: string; name: string };
  level: LevelCode;
  levelLabel: string;
  session: { name: string };
  fee: { name: string; amount: number; currency: string };
  alreadyPaid: boolean;
  /** Present only when the student has already paid — lets them reach the receipt. */
  existingReference?: string;
};

export type InitializedPayment = {
  reference: string;
  authorizationUrl: string;
  amount: number;
  currency: string;
  reused: boolean;
};

export type FulfilmentOutcome = {
  payment: Payment;
  receipt: Receipt;
  /** False when this call is a repeat of an already-completed fulfilment. */
  newlyFulfilled: boolean;
};

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------

/**
 * Resolve what this student owes. Read-only: nothing is created, so a student
 * reviewing their details twice does not litter the database.
 */
export async function quotePayment(input: StudentSubmission): Promise<PaymentQuote> {
  const [session, department] = await Promise.all([
    requireActiveSession(),
    requireActiveDepartment(input.departmentId),
  ]);

  const fee = await requireActiveFee(session.id, input.level);

  if (!isValidChargeAmount(fee.amount)) {
    // Configuration is broken; students must not be sent to checkout with it.
    logger.error("payment_initialization_failed", {
      reason: "invalid_configured_amount",
      feeId: fee.id,
      amount: fee.amount,
    });
    throw new AppError(
      "NO_FEE_CONFIGURED",
      "Dues for your level are not correctly configured. Please contact the college office.",
    );
  }

  const existing = await findFulfilledPayment(input.matricNormal, session.id, fee.id);

  return {
    fullName: input.fullName,
    matricNumber: input.matricNumber,
    email: input.email,
    department: { id: department.id, name: department.name },
    level: input.level,
    levelLabel: levelLabel(input.level),
    session: { name: session.name },
    fee: { name: fee.name, amount: fee.amount, currency: fee.currency },
    alreadyPaid: Boolean(existing),
    existingReference: existing?.reference,
  };
}

/** The one successful payment for this student/session/fee, if any. */
export async function findFulfilledPayment(
  matricNormal: string,
  sessionId: string,
  feeId: string,
): Promise<Payment | null> {
  return prisma.payment.findFirst({
    where: { matricNormal, sessionId, feeId, status: "SUCCESS" },
  });
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export async function initializePayment(
  input: StudentSubmission,
): Promise<InitializedPayment> {
  const [session, department] = await Promise.all([
    requireActiveSession(),
    requireActiveDepartment(input.departmentId),
  ]);

  const fee = await requireActiveFee(session.id, input.level);

  if (!isValidChargeAmount(fee.amount)) {
    throw new AppError(
      "NO_FEE_CONFIGURED",
      "Dues for your level are not correctly configured. Please contact the college office.",
    );
  }

  // Re-check duplicates immediately before creating anything.
  const alreadyPaid = await findFulfilledPayment(input.matricNormal, session.id, fee.id);
  if (alreadyPaid) {
    throw new AppError(
      "PAYMENT_ALREADY_COMPLETED",
      `COLBIOS dues for the ${session.name} session have already been paid with this matric number.`,
      { context: { reference: alreadyPaid.reference } },
    );
  }

  // A student who double-clicks, or reloads and submits again, should land back
  // on the checkout they already have rather than accumulating pending rows.
  const reusable = await prisma.payment.findFirst({
    where: {
      matricNormal: input.matricNormal,
      sessionId: session.id,
      feeId: fee.id,
      status: "PENDING",
      amount: fee.amount,
      currency: fee.currency,
      authorizationUrl: { not: null },
      createdAt: { gte: new Date(Date.now() - PENDING_REUSE_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (reusable?.authorizationUrl) {
    logger.info("payment_reused_pending", {
      reference: reusable.reference,
      matricNormal: reusable.matricNormal,
    });
    return {
      reference: reusable.reference,
      authorizationUrl: reusable.authorizationUrl,
      amount: reusable.amount,
      currency: reusable.currency,
      reused: true,
    };
  }

  const reference = generatePaymentReference(session.name);

  // Created PENDING *before* the provider call, so a transaction that starts at
  // Paystack always has a record on our side to reconcile against.
  const payment = await prisma.payment.create({
    data: {
      reference,
      fullName: input.fullName,
      matricNumber: input.matricNumber,
      matricNormal: input.matricNormal,
      email: input.email,
      departmentId: department.id,
      departmentName: department.name,
      level: input.level,
      sessionId: session.id,
      sessionName: session.name,
      feeId: fee.id,
      feeName: fee.name,
      amount: fee.amount,
      currency: fee.currency,
      status: "PENDING",
    },
  });

  try {
    const initialized = await paystack.initializeTransaction({
      email: payment.email,
      amount: payment.amount, // kobo, straight from the database
      currency: payment.currency,
      reference: payment.reference,
      callback_url: absoluteUrl(`/pay/callback?reference=${encodeURIComponent(payment.reference)}`),
      metadata: {
        paymentId: payment.id,
        feeId: payment.feeId,
        sessionId: payment.sessionId,
        level: payment.level,
        custom_fields: [
          { display_name: "Matric Number", variable_name: "matric_number", value: payment.matricNumber },
          { display_name: "Level", variable_name: "level", value: levelLabel(input.level) },
          { display_name: "Department", variable_name: "department", value: payment.departmentName },
        ],
      },
    });

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        authorizationUrl: initialized.authorization_url,
        accessCode: initialized.access_code,
      },
    });

    logger.info("payment_initialized", {
      reference: updated.reference,
      amount: updated.amount,
      currency: updated.currency,
      level: updated.level,
      sessionName: updated.sessionName,
    });

    return {
      reference: updated.reference,
      authorizationUrl: initialized.authorization_url,
      amount: updated.amount,
      currency: updated.currency,
      reused: false,
    };
  } catch (error) {
    // The provider never accepted this attempt: retire the row so it cannot be
    // mistaken for a checkout the student actually reached.
    await prisma.payment
      .update({
        where: { id: payment.id },
        data: { status: "FAILED", failureReason: "Checkout could not be started." },
      })
      .catch(() => undefined);

    logger.error("payment_initialization_failed", {
      reference: payment.reference,
      ...describeError(error),
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Fulfilment
// ---------------------------------------------------------------------------

export type FulfilSource = "WEBHOOK" | "VERIFY";

/**
 * Apply a verified provider transaction to a payment, atomically.
 *
 * The row is locked with SELECT … FOR UPDATE, so concurrent webhook and
 * callback fulfilment serialise: the first commits the status change and the
 * receipt, the second sees SUCCESS and returns the same receipt.
 */
export async function fulfilPayment(
  reference: string,
  transaction: PaystackTransaction,
  source: FulfilSource,
): Promise<FulfilmentOutcome> {
  const outcome = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string; status: PaymentStatusValue }>>`
      SELECT "id", "status" FROM "Payment" WHERE "reference" = ${reference} FOR UPDATE
    `;

    if (locked.length === 0) {
      throw new AppError("PAYMENT_NOT_FOUND", "We could not find a payment with that reference.", {
        context: { reference },
      });
    }

    const current = await tx.payment.findUniqueOrThrow({
      where: { id: locked[0].id },
      include: { receipt: true },
    });

    // Already fulfilled: return what exists. This is the idempotent path taken
    // by duplicate webhooks and by a student refreshing the success page.
    if (current.status === "SUCCESS" && current.receipt) {
      return {
        payment: current,
        receipt: current.receipt,
        newlyFulfilled: false,
      } satisfies FulfilmentOutcome;
    }

    const check = checkProviderTransaction(
      { reference: current.reference, amount: current.amount, currency: current.currency },
      transaction,
    );

    if (!check.ok) throw providerCheckError(check.reason, check.detail, current.reference);

    assertTransition(current.status as PaymentStatusValue, "SUCCESS");

    const paidAt = resolvePaidAt(transaction);

    let payment: Payment;
    try {
      payment = await tx.payment.update({
        where: { id: current.id },
        data: {
          status: "SUCCESS",
          paystackTransactionId: String(transaction.id),
          channel: resolveChannel(transaction),
          paidAt,
          failureReason: null,
        },
      });
    } catch (error) {
      // The provider transaction id is unique across payments. Hitting that
      // constraint means this transaction is already recorded against a
      // *different* payment — an anomaly worth surfacing precisely rather than
      // letting a raw database error escape as a 500 that Paystack retries.
      if (isUniqueViolation(error)) {
        logger.error("payment_failed", {
          reference: current.reference,
          reason: "provider_transaction_already_used",
          transactionId: String(transaction.id),
        });
        throw new AppError(
          "DUPLICATE_RESOURCE",
          "This provider transaction is already recorded against another payment. Please contact the college office.",
          { context: { reference: current.reference, transactionId: String(transaction.id) } },
        );
      }
      throw error;
    }

    // A receipt may already exist if a previous run committed the receipt but
    // the status is being re-applied; the unique constraint on paymentId is the
    // backstop that guarantees exactly one.
    const receipt =
      current.receipt ??
      (await tx.receipt.create({
        data: {
          paymentId: payment.id,
          receiptNumber: await nextReceiptNumber(tx, sessionYear(payment.sessionName, paidAt)),
          issuedAt: paidAt,
        },
      }));

    return { payment, receipt, newlyFulfilled: true } satisfies FulfilmentOutcome;
  });

  if (outcome.newlyFulfilled) {
    logger.info("payment_verified", {
      reference: outcome.payment.reference,
      source,
      amount: outcome.payment.amount,
      currency: outcome.payment.currency,
      channel: outcome.payment.channel,
      transactionId: outcome.payment.paystackTransactionId,
    });
    logger.info("receipt_created", {
      reference: outcome.payment.reference,
      receiptNumber: outcome.receipt.receiptNumber,
    });
  } else {
    logger.info("payment_already_fulfilled", { reference: outcome.payment.reference, source });
  }

  return outcome;
}

function providerCheckError(
  reason: ProviderCheckFailure,
  detail: Record<string, unknown>,
  reference: string,
): AppError {
  switch (reason) {
    case "AMOUNT_MISMATCH":
      logger.error("payment_amount_mismatch", { reference, ...detail });
      return new AppError(
        "AMOUNT_MISMATCH",
        "The amount paid does not match the dues for your level. Please contact the college office.",
        { context: { reference, ...detail } },
      );
    case "CURRENCY_MISMATCH":
      logger.error("payment_currency_mismatch", { reference, ...detail });
      return new AppError(
        "CURRENCY_MISMATCH",
        "The payment currency does not match the dues for your level. Please contact the college office.",
        { context: { reference, ...detail } },
      );
    case "REFERENCE_MISMATCH":
      logger.error("payment_failed", { reference, reason: "reference_mismatch", ...detail });
      return new AppError("INVALID_REFERENCE", "That payment reference is not valid.", {
        context: { reference, ...detail },
      });
    case "NOT_SUCCESSFUL":
    default:
      return new AppError("PAYMENT_NOT_SUCCESSFUL", "This payment has not been completed.", {
        context: { reference, ...detail },
      });
  }
}

/**
 * Record a non-successful provider outcome (failed, abandoned, reversed…).
 * Never downgrades a payment that has already succeeded.
 */
export async function applyUnsuccessfulStatus(
  reference: string,
  status: PaymentStatusValue,
  failureReason: string | null,
): Promise<Payment | null> {
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment) return null;

  const from = payment.status as PaymentStatusValue;
  if (from === status) return payment;
  if (!canTransition(from, status)) return payment;

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { status, failureReason: failureReason?.slice(0, 300) ?? null },
  });

  logger.info("payment_failed", { reference, status, from });
  return updated;
}

// ---------------------------------------------------------------------------
// Server-side verification
// ---------------------------------------------------------------------------

export type VerificationResult =
  | { state: "SUCCESS"; payment: Payment; receipt: Receipt; newlyFulfilled: boolean }
  | { state: "PENDING"; payment: Payment }
  | { state: "FAILED"; payment: Payment; status: PaymentStatusValue };

/**
 * Ask Paystack about a reference and apply the answer.
 *
 * This is what the callback page and the /api/payments/verify endpoint use. A
 * browser redirect on its own never changes a payment's status.
 */
export async function verifyPaymentByReference(reference: string): Promise<VerificationResult> {
  const payment = await prisma.payment.findUnique({
    where: { reference },
    include: { receipt: true },
  });

  if (!payment) {
    throw new AppError("PAYMENT_NOT_FOUND", "We could not find a payment with that reference.");
  }

  // Already settled — no need to call the provider again.
  if (payment.status === "SUCCESS" && payment.receipt) {
    return {
      state: "SUCCESS",
      payment,
      receipt: payment.receipt,
      newlyFulfilled: false,
    };
  }

  logger.info("payment_verification_started", { reference });

  const transaction = await paystack.verifyTransaction(reference);
  const providerStatus = String(transaction.status ?? "").toLowerCase();

  if (providerStatus === "success") {
    const outcome = await fulfilPayment(reference, transaction, "VERIFY");
    await recordPaymentEvent({
      providerEventId: `verify:charge.success:${transaction.id}`,
      source: "VERIFY",
      eventType: "charge.success",
      reference,
      paymentId: outcome.payment.id,
      payload: transaction as unknown as Prisma.InputJsonValue,
      processed: true,
    });
    return {
      state: "SUCCESS",
      payment: outcome.payment,
      receipt: outcome.receipt,
      newlyFulfilled: outcome.newlyFulfilled,
    };
  }

  if (providerStatus === "failed" || providerStatus === "abandoned" || providerStatus === "reversed") {
    const mapped: PaymentStatusValue =
      providerStatus === "failed" ? "FAILED" : providerStatus === "reversed" ? "REVERSED" : "ABANDONED";
    const updated =
      (await applyUnsuccessfulStatus(reference, mapped, transaction.gateway_response ?? null)) ??
      payment;
    return { state: "FAILED", payment: updated, status: updated.status as PaymentStatusValue };
  }

  // "ongoing", "pending", "queued" — the provider has not decided yet.
  return { state: "PENDING", payment };
}

// ---------------------------------------------------------------------------
// Provider events
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Administrative adjustments
// ---------------------------------------------------------------------------

export type ManualAdjustmentInput = {
  paymentId: string;
  reason: string;
  adminId: string;
};

/**
 * Record a payment the college received outside Paystack (a bank transfer to
 * the college account, say) against an existing pending attempt.
 *
 * This is deliberately not a "mark as paid" button:
 *  - it is restricted to FINANCE and SUPER_ADMIN by the calling action;
 *  - it demands a written reason, stored on the payment itself;
 *  - it stamps the administrator and the time;
 *  - the payment is flagged `isManualAdjustment`, and every surface that shows
 *    it — the admin table, the receipt, the public verification page — says so.
 *
 * It never fabricates a Paystack transaction id.
 */
export async function recordManualAdjustment(
  input: ManualAdjustmentInput,
): Promise<FulfilmentOutcome> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Payment" WHERE "id" = ${input.paymentId} FOR UPDATE
    `;
    if (locked.length === 0) throw new AppError("PAYMENT_NOT_FOUND");

    const current = await tx.payment.findUniqueOrThrow({
      where: { id: input.paymentId },
      include: { receipt: true },
    });

    if (current.status === "SUCCESS" && current.receipt) {
      throw new AppError(
        "PAYMENT_ALREADY_COMPLETED",
        "This payment has already been completed — there is nothing to adjust.",
      );
    }

    assertTransition(current.status as PaymentStatusValue, "SUCCESS");

    const now = new Date();
    const payment = await tx.payment.update({
      where: { id: current.id },
      data: {
        status: "SUCCESS",
        channel: "manual_adjustment",
        paidAt: now,
        isManualAdjustment: true,
        manualReason: input.reason,
        manualAdjustedById: input.adminId,
        manualAdjustedAt: now,
        failureReason: null,
      },
    });

    const receipt =
      current.receipt ??
      (await tx.receipt.create({
        data: {
          paymentId: payment.id,
          receiptNumber: await nextReceiptNumber(tx, sessionYear(payment.sessionName, now)),
          issuedAt: now,
        },
      }));

    return { payment, receipt, newlyFulfilled: true } satisfies FulfilmentOutcome;
  });
}

/**
 * Record that a completed payment was refunded or reversed. Does not move money
 * — Paystack does that — it records the outcome so the student's dues status and
 * the college's totals stay truthful.
 */
export async function recordRefundOutcome(
  paymentId: string,
  status: Extract<PaymentStatusValue, "REFUNDED" | "REVERSED">,
  reason: string,
  adminId: string,
): Promise<Payment> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new AppError("PAYMENT_NOT_FOUND");

  assertTransition(payment.status as PaymentStatusValue, status);

  return prisma.payment.update({
    where: { id: payment.id },
    data: {
      status,
      manualReason: reason,
      manualAdjustedById: adminId,
      manualAdjustedAt: new Date(),
    },
  });
}

export type RecordEventInput = {
  providerEventId: string;
  source: "WEBHOOK" | "VERIFY" | "SYSTEM";
  eventType: string;
  reference: string;
  paymentId?: string | null;
  payload: Prisma.InputJsonValue;
  processed?: boolean;
  error?: string | null;
};

/**
 * Store a provider event. Returns false when the event id already exists, which
 * is exactly the duplicate-webhook signal the webhook route acts on.
 */
export async function recordPaymentEvent(input: RecordEventInput): Promise<boolean> {
  try {
    await prisma.paymentEvent.create({
      data: {
        providerEventId: input.providerEventId,
        source: input.source,
        eventType: input.eventType,
        reference: input.reference,
        paymentId: input.paymentId ?? null,
        payload: input.payload,
        processed: input.processed ?? false,
        processedAt: input.processed ? new Date() : null,
        error: input.error ?? null,
      },
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

export async function markEventProcessed(
  providerEventId: string,
  outcome: { paymentId?: string | null; error?: string | null },
): Promise<void> {
  await prisma.paymentEvent
    .update({
      where: { providerEventId },
      data: {
        processed: outcome.error ? false : true,
        processedAt: new Date(),
        paymentId: outcome.paymentId ?? undefined,
        error: outcome.error ?? null,
      },
    })
    .catch(() => undefined);
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
