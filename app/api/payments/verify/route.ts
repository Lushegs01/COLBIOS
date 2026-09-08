import type { NextRequest } from "next/server";

import { dispatchConfirmationEmailInBackground } from "@/lib/email/dispatch";
import { AppError, ok, toErrorResponse } from "@/lib/http/api";
import { verifyPaymentByReference } from "@/lib/payments/service";
import {
  RATE_LIMITS,
  checkRateLimit,
  clientIdentifier,
  rateLimitHeaders,
} from "@/lib/rate-limit/limiter";
import { fieldErrors, verifyPaymentSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/verify
 *
 * Asks Paystack directly what happened to a reference and applies the answer.
 * This is the only thing that can move a payment to SUCCESS from the browser's
 * side of the world — returning from checkout proves nothing on its own.
 */
export async function POST(request: NextRequest) {
  try {
    const limit = await checkRateLimit(
      RATE_LIMITS.paymentVerify,
      clientIdentifier(request.headers),
    );
    if (!limit.allowed) {
      throw new AppError("RATE_LIMITED", "Too many attempts. Please try again shortly.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("INVALID_REQUEST", "That request could not be understood.");
    }

    const parsed = verifyPaymentSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("INVALID_REFERENCE", "That payment reference is not valid.", {
        details: fieldErrors(parsed.error),
      });
    }

    const result = await verifyPaymentByReference(parsed.data.reference);

    if (result.state === "SUCCESS") {
      // Post-payment side effect: only after verified success, exactly once
      // across every fulfilment path, and never allowed to affect this response.
      dispatchConfirmationEmailInBackground(result.payment, result.receipt);

      return ok(
        {
          status: "SUCCESS" as const,
          reference: result.payment.reference,
          receiptNumber: result.receipt.receiptNumber,
          amount: result.payment.amount,
          currency: result.payment.currency,
          paidAt: result.payment.paidAt,
          channel: result.payment.channel,
        },
        { headers: rateLimitHeaders(limit) },
      );
    }

    if (result.state === "PENDING") {
      return ok(
        { status: "PENDING" as const, reference: result.payment.reference },
        { headers: rateLimitHeaders(limit) },
      );
    }

    return ok(
      {
        status: result.status,
        reference: result.payment.reference,
        reason: result.payment.failureReason,
      },
      { headers: rateLimitHeaders(limit) },
    );
  } catch (error) {
    return toErrorResponse(error, "POST /api/payments/verify");
  }
}
