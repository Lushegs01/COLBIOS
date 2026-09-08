"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { diffMetadata, recordAudit } from "@/lib/audit/log";
import { requireAdminApi } from "@/lib/auth/guard";
import { assertCsrf } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/http/api";
import { describeError, logger } from "@/lib/logger";
import { dispatchConfirmationEmail } from "@/lib/email/dispatch";
import {
  recordManualAdjustment,
  recordRefundOutcome,
  verifyPaymentByReference,
} from "@/lib/payments/service";
import { clientIdentifier } from "@/lib/rate-limit/limiter";
import { cuidSchema, manualAdjustmentSchema } from "@/lib/validation/schemas";

export type ActionState = { error: string | null; success: string | null };

export const IDLE_STATE: ActionState = { error: null, success: null };

/**
 * Administrative actions on a payment.
 *
 * Each one independently authorises the caller — being inside the admin layout
 * is not treated as permission — checks the CSRF token, and writes an audit row
 * naming the administrator, the change and the reason.
 */

/** Re-run server-side verification against Paystack for a stuck payment. */
export async function reverifyPaymentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await requireAdminApi("payments:read");
    if (!(await assertCsrf(String(formData.get("csrf") ?? "")))) {
      throw new AppError("CSRF_FAILED");
    }

    const reference = String(formData.get("reference") ?? "");
    const result = await verifyPaymentByReference(reference);

    if (result.state === "SUCCESS") {
      await dispatchConfirmationEmail(result.payment, result.receipt).catch(() => undefined);
    }

    await recordAudit({
      action: "MANUAL_PAYMENT_ADJUSTMENT",
      entityType: "Payment",
      entityId: result.payment.id,
      adminId: admin.id,
      adminEmail: admin.email,
      metadata: { operation: "REVERIFY", reference, outcome: result.state },
      ip: clientIdentifier(await headers()),
    });

    revalidatePath(`/admin/payments/${result.payment.id}`);
    return {
      error: null,
      success:
        result.state === "SUCCESS"
          ? "Paystack confirms this payment. It is now marked successful."
          : result.state === "PENDING"
            ? "Paystack has not settled this transaction yet."
            : "Paystack reports this transaction did not succeed.",
    };
  } catch (error) {
    return toState(error, "reverifyPaymentAction");
  }
}

/** Record an off-Paystack payment. Restricted to FINANCE and SUPER_ADMIN. */
export async function manualAdjustmentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await requireAdminApi("payments:adjust");
    if (!(await assertCsrf(String(formData.get("csrf") ?? "")))) {
      throw new AppError("CSRF_FAILED");
    }

    const parsed = manualAdjustmentSchema.safeParse({
      paymentId: String(formData.get("paymentId") ?? ""),
      reason: String(formData.get("reason") ?? ""),
      confirmation: String(formData.get("confirmation") ?? ""),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the form and try again.", success: null };
    }

    const before = await prisma.payment.findUnique({ where: { id: parsed.data.paymentId } });
    if (!before) throw new AppError("PAYMENT_NOT_FOUND");

    const outcome = await recordManualAdjustment({
      paymentId: parsed.data.paymentId,
      reason: parsed.data.reason,
      adminId: admin.id,
    });

    await recordAudit({
      action: "MANUAL_PAYMENT_ADJUSTMENT",
      entityType: "Payment",
      entityId: outcome.payment.id,
      adminId: admin.id,
      adminEmail: admin.email,
      metadata: {
        operation: "RECORD_OFFLINE_PAYMENT",
        reference: outcome.payment.reference,
        matricNumber: outcome.payment.matricNumber,
        amountMinor: outcome.payment.amount,
        currency: outcome.payment.currency,
        reason: parsed.data.reason,
        receiptNumber: outcome.receipt.receiptNumber,
        changes: diffMetadata(
          { status: before.status },
          { status: outcome.payment.status },
        ),
      },
      ip: clientIdentifier(await headers()),
    });

    revalidatePath(`/admin/payments/${outcome.payment.id}`);
    return {
      error: null,
      success: `Recorded as a manual adjustment. Receipt ${outcome.receipt.receiptNumber} was issued and is marked as not collected through Paystack.`,
    };
  } catch (error) {
    return toState(error, "manualAdjustmentAction");
  }
}

/** Record a refund or reversal against a completed payment. */
export async function refundAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await requireAdminApi("payments:adjust");
    if (!(await assertCsrf(String(formData.get("csrf") ?? "")))) {
      throw new AppError("CSRF_FAILED");
    }

    const paymentId = cuidSchema.safeParse(String(formData.get("paymentId") ?? ""));
    if (!paymentId.success) throw new AppError("PAYMENT_NOT_FOUND");

    const status = String(formData.get("status") ?? "");
    if (status !== "REFUNDED" && status !== "REVERSED") {
      throw new AppError("INVALID_REQUEST", "Choose whether this is a refund or a reversal.");
    }

    const reason = String(formData.get("reason") ?? "").trim();
    if (reason.length < 20) {
      return {
        error: "Give a full reason (at least 20 characters) — this is permanently recorded.",
        success: null,
      };
    }

    const before = await prisma.payment.findUnique({ where: { id: paymentId.data } });
    if (!before) throw new AppError("PAYMENT_NOT_FOUND");

    const payment = await recordRefundOutcome(paymentId.data, status, reason, admin.id);

    await recordAudit({
      action: "REFUND_ACTION",
      entityType: "Payment",
      entityId: payment.id,
      adminId: admin.id,
      adminEmail: admin.email,
      metadata: {
        reference: payment.reference,
        amountMinor: payment.amount,
        currency: payment.currency,
        reason,
        changes: diffMetadata({ status: before.status }, { status: payment.status }),
      },
      ip: clientIdentifier(await headers()),
    });

    revalidatePath(`/admin/payments/${payment.id}`);
    return { error: null, success: `Payment recorded as ${status.toLowerCase()}.` };
  } catch (error) {
    return toState(error, "refundAction");
  }
}

function toState(error: unknown, scope: string): ActionState {
  if (error instanceof AppError) return { error: error.message, success: null };
  logger.error("unexpected_error", { scope, ...describeError(error) });
  return { error: "Something went wrong. Please try again.", success: null };
}
