import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { recheckPaymentAction } from "@/app/payment/actions";
import { ButtonLink } from "@/components/ui/Button";
import { Card, DetailRow, Notice, PageTitle, PayShell } from "@/components/ui/Surfaces";
import { formatMoney } from "@/lib/format/money";
import { findPublicPayment } from "@/lib/payments/lookup";
import { referenceSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment pending",
  robots: { index: false, follow: false },
};

/**
 * The honest middle state.
 *
 * Reached when the provider has not settled the transaction yet, or when we
 * could not reach it. It never claims failure — the webhook may still confirm
 * the payment moments later — and the "Check again" button re-runs the same
 * server-side verification with no client JavaScript.
 */
export default async function PaymentPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; checked?: string; throttled?: string }>;
}) {
  const params = await searchParams;
  const parsed = referenceSchema.safeParse(params.reference ?? "");
  if (!parsed.success) redirect("/pay");

  const payment = await findPublicPayment(parsed.data);
  if (!payment) redirect("/pay");

  if (payment.status === "SUCCESS") {
    redirect(`/payment/success?reference=${encodeURIComponent(payment.reference)}`);
  }
  if (payment.status === "FAILED" || payment.status === "ABANDONED") {
    redirect(`/payment/failed?reference=${encodeURIComponent(payment.reference)}`);
  }

  return (
    <PayShell>
      <PageTitle
        eyebrow="Payment pending"
        title="We're confirming your payment"
        description="This usually takes a few seconds. Your payment is safe — we are waiting for the payment provider to confirm it."
      />

      <Card>
        {params.throttled ? (
          <div className="mb-5">
            <Notice tone="warning" title="Too many checks">
              Please wait a moment before checking again.
            </Notice>
          </div>
        ) : params.checked ? (
          <div className="mb-5">
            <Notice tone="info" title="Still confirming">
              The payment provider has not confirmed this payment yet. You can safely close this
              page — your receipt will be emailed as soon as it is confirmed.
            </Notice>
          </div>
        ) : null}

        <dl>
          <DetailRow label="Amount" value={formatMoney(payment.amount, payment.currency)} emphasis />
          <DetailRow label="Full name" value={payment.fullName} />
          <DetailRow label="Matric number" value={payment.matricNumber} mono />
          <DetailRow label="Academic session" value={payment.sessionName} />
          <DetailRow label="Payment reference" value={payment.reference} mono />
        </dl>

        <form action={recheckPaymentAction} className="mt-6">
          <input type="hidden" name="reference" value={payment.reference} />
          <button
            type="submit"
            className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-pine-700 px-6 text-[15px] font-semibold text-white shadow-soft transition-colors hover:bg-pine-800"
          >
            Check again
          </button>
        </form>

        <div className="mt-3">
          <ButtonLink href="/pay" variant="secondary" size="lg" className="w-full">
            Back to payments
          </ButtonLink>
        </div>
      </Card>

      <p className="mt-5 text-center text-[12.5px] leading-relaxed text-muted">
        If money left your account but this page still says pending after a few minutes, contact the
        college office with your payment reference{" "}
        <span className="font-mono text-ink">{payment.reference}</span>.
      </p>
    </PayShell>
  );
}
