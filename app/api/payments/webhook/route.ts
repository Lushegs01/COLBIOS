import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { dispatchConfirmationEmailInBackground } from "@/lib/email/dispatch";
import { describeError, logger } from "@/lib/logger";
import { PAYSTACK_SIGNATURE_HEADER } from "@/lib/paystack/signature";
import { handleWebhook } from "@/lib/payments/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/webhook
 *
 * Paystack's authoritative fulfilment channel.
 *
 * Two things this handler does deliberately:
 *  - It reads the body as raw text. The HMAC is computed over the exact bytes
 *    Paystack signed; parsing to JSON first and re-serialising would never match.
 *  - It answers 200 for anything it has definitively dealt with, including
 *    duplicates and events it does not care about, so Paystack stops retrying.
 *    Only a genuine processing failure returns 500, which is what *should* be
 *    retried.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get(PAYSTACK_SIGNATURE_HEADER);

  try {
    const outcome = await handleWebhook(rawBody, signature);

    if (outcome.status === "processed") {
      await sendConfirmationIfNewlyFulfilled(outcome.reference);
    }

    return NextResponse.json({ received: true, status: outcome.status });
  } catch (error) {
    // An invalid signature is not a server error — it is a rejected request,
    // and it must not tell the sender anything beyond "no".
    if (isRejectedRequest(error)) {
      return NextResponse.json({ received: false }, { status: 400 });
    }

    logger.error("webhook_processing_failed", { ...describeError(error) });
    // 500 asks Paystack to retry; the event row records why the last try failed.
    return NextResponse.json({ received: false }, { status: 500 });
  }
}

function isRejectedRequest(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ["FORBIDDEN", "INVALID_REQUEST"].includes(String((error as { code?: unknown }).code))
  );
}

/**
 * Ask for the confirmation email. `dispatchConfirmationEmail` de-duplicates
 * against the verification path with a conditional update, so it is safe to
 * call here on every processed delivery.
 */
async function sendConfirmationIfNewlyFulfilled(reference: string): Promise<void> {
  try {
    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: { receipt: true },
    });
    if (payment?.status === "SUCCESS" && payment.receipt) {
      dispatchConfirmationEmailInBackground(payment, payment.receipt);
    }
  } catch (error) {
    logger.error("email_failed", { reference, ...describeError(error) });
  }
}
