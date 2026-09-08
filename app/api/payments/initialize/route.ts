import type { NextRequest } from "next/server";

import { AppError, ok, toErrorResponse } from "@/lib/http/api";
import { initializePayment } from "@/lib/payments/service";
import {
  RATE_LIMITS,
  checkRateLimit,
  clientIdentifier,
  rateLimitHeaders,
} from "@/lib/rate-limit/limiter";
import { fieldErrors, initializePaymentSchema, normaliseMatric } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/initialize
 *
 * The body carries identity only — full name, matric number, email, department
 * and level. No amount, no fee id, no session id: the server resolves all of
 * those from the database and sends *its* amount to Paystack.
 *
 * Returns the provider's authorization URL for the browser to follow.
 */
export async function POST(request: NextRequest) {
  try {
    const limit = await checkRateLimit(
      RATE_LIMITS.paymentInitialize,
      clientIdentifier(request.headers),
    );
    if (!limit.allowed) {
      throw new AppError("RATE_LIMITED", "Too many payment attempts. Please try again shortly.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("INVALID_REQUEST", "That request could not be understood.");
    }

    const parsed = initializePaymentSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Please check the details you entered.", {
        details: fieldErrors(parsed.error),
      });
    }

    const result = await initializePayment({
      ...parsed.data,
      matricNormal: normaliseMatric(parsed.data.matricNumber),
    });

    return ok(
      {
        reference: result.reference,
        authorizationUrl: result.authorizationUrl,
        amount: result.amount,
        currency: result.currency,
      },
      { headers: rateLimitHeaders(limit) },
    );
  } catch (error) {
    return toErrorResponse(error, "POST /api/payments/initialize");
  }
}
