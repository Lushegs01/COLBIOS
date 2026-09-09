import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, Notice, PageTitle, PayShell } from "@/components/ui/Surfaces";
import { dispatchConfirmationEmail } from "@/lib/email/dispatch";
import { describeError, logger } from "@/lib/logger";
import { verifyPaymentByReference } from "@/lib/payments/service";
import { referenceSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirming your payment",
  robots: { index: false, follow: false },
};

/**
 * Where Paystack sends the student's browser after checkout.
 *
 * The redirect itself proves nothing — it can be typed into an address bar. All
 * this page does is take the reference and run the *server-side* verification,
 * then send the student to the page that matches the real, provider-confirmed
 * outcome. Nothing here can mark a payment successful on its own.
 *
 * Next's data-security guide advises against mutations as a render side effect,
 * and this page does mutate: it settles the payment. That is a deliberate
 * exception, and it is safe because fulfilment is idempotent — it locks the
 * payment row, re-checks the status, and issues at most one receipt — so a
 * repeated render cannot double-fulfil. The alternative, an auto-submitting
 * form, would make confirmation depend on JavaScript, which is exactly what
 * this flow avoids for students on slow connections and low-end phones.
 */
export default async function CallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = typeof params.reference === "string" ? params.reference : params.trxref;
  const parsed = referenceSchema.safeParse(typeof raw === "string" ? raw : "");

  if (!parsed.success) {
    return (
      <PayShell>
        <PageTitle title="We could not identify that payment" />
        <Card>
          <Notice tone="error" title="Missing payment reference">
            This page needs a valid payment reference. If you have just paid, open the link in your
            confirmation email, or contact the college office with your Paystack receipt.
          </Notice>
        </Card>
      </PayShell>
    );
  }

  const reference = parsed.data;

  try {
    const result = await verifyPaymentByReference(reference);

    if (result.state === "SUCCESS") {
      // Awaited rather than backgrounded: on a serverless platform the function
      // may be frozen the moment we redirect, so a fire-and-forget email here
      // could simply never be sent. It is de-duplicated, so the webhook path
      // will not send a second one.
      await dispatchConfirmationEmail(result.payment, result.receipt).catch(() => undefined);
      redirect(`/payment/success?reference=${encodeURIComponent(reference)}`);
    }

    if (result.state === "PENDING") {
      redirect(`/payment/pending?reference=${encodeURIComponent(reference)}`);
    }

    redirect(`/payment/failed?reference=${encodeURIComponent(reference)}`);
  } catch (error) {
    // `redirect` throws by design — let it through.
    if (isRedirectError(error)) throw error;

    // Anything else (provider unreachable, database blip) is a *pending*
    // outcome, never a failure: the student may well have paid, and the webhook
    // will settle it. Telling them it failed would be a lie.
    logger.error("payment_verification_started", {
      reference,
      stage: "callback",
      ...describeError(error),
    });
    redirect(`/payment/pending?reference=${encodeURIComponent(reference)}`);
  }
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
