"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { dispatchConfirmationEmail } from "@/lib/email/dispatch";
import { describeError, logger } from "@/lib/logger";
import { verifyPaymentByReference } from "@/lib/payments/service";
import { RATE_LIMITS, checkRateLimit, clientIdentifier } from "@/lib/rate-limit/limiter";
import { referenceSchema } from "@/lib/validation/schemas";

/**
 * "Check again" on the pending screen.
 *
 * A server action rather than client-side polling: the pending page then needs
 * no JavaScript at all, which matters on the slow connections this flow is
 * built for. The check is rate limited like every other verification path.
 */
export async function recheckPaymentAction(formData: FormData): Promise<void> {
  const parsed = referenceSchema.safeParse(String(formData.get("reference") ?? ""));
  if (!parsed.success) redirect("/pay");

  const reference = parsed.data;
  const limit = await checkRateLimit(RATE_LIMITS.paymentVerify, clientIdentifier(await headers()));

  if (!limit.allowed) {
    redirect(`/payment/pending?reference=${encodeURIComponent(reference)}&throttled=1`);
  }

  try {
    const result = await verifyPaymentByReference(reference);

    if (result.state === "SUCCESS") {
      await dispatchConfirmationEmail(result.payment, result.receipt).catch(() => undefined);
      redirect(`/payment/success?reference=${encodeURIComponent(reference)}`);
    }
    if (result.state === "FAILED") {
      redirect(`/payment/failed?reference=${encodeURIComponent(reference)}`);
    }
  } catch (error) {
    if (isRedirectError(error)) throw error;
    logger.error("payment_verification_started", {
      reference,
      stage: "recheck",
      ...describeError(error),
    });
  }

  redirect(`/payment/pending?reference=${encodeURIComponent(reference)}&checked=1`);
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
