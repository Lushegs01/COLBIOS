import type { NextRequest } from "next/server";

import { AppError, ok, toErrorResponse } from "@/lib/http/api";
import { levelLabel } from "@/lib/format/level";
import { quotePayment } from "@/lib/payments/service";
import {
  RATE_LIMITS,
  checkRateLimit,
  clientIdentifier,
  rateLimitHeaders,
} from "@/lib/rate-limit/limiter";
import { fieldErrors, normaliseMatric, paymentQuoteSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/quote
 *
 * Tells the student what they owe. Read-only — it creates nothing — but it is
 * still rate limited, because it is the endpoint an attacker would use to probe
 * matric numbers. Note that the response deliberately contains no database ids
 * beyond the department id the form already had.
 */
export async function POST(request: NextRequest) {
  try {
    const limit = await checkRateLimit(RATE_LIMITS.paymentQuote, clientIdentifier(request.headers));
    if (!limit.allowed) {
      throw new AppError("RATE_LIMITED", "Too many attempts. Please try again shortly.");
    }

    const body = await readJson(request);
    const parsed = paymentQuoteSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Please check the details you entered.", {
        details: fieldErrors(parsed.error),
      });
    }

    const quote = await quotePayment({
      ...parsed.data,
      matricNormal: normaliseMatric(parsed.data.matricNumber),
    });

    return ok(
      {
        fullName: quote.fullName,
        matricNumber: quote.matricNumber,
        email: quote.email,
        department: quote.department.name,
        departmentId: quote.department.id,
        level: quote.level,
        levelLabel: levelLabel(quote.level),
        sessionName: quote.session.name,
        feeName: quote.fee.name,
        amount: quote.fee.amount,
        currency: quote.fee.currency,
        alreadyPaid: quote.alreadyPaid,
        existingReference: quote.existingReference ?? null,
      },
      { headers: rateLimitHeaders(limit) },
    );
  } catch (error) {
    return toErrorResponse(error, "POST /api/payments/quote");
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("INVALID_REQUEST", "That request could not be understood.");
  }
}
