import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { recheckPaymentAction } from "@/app/payment/actions";
import { ButtonLink } from "@/components/ui/Button";
import { Card, DetailRow, Notice, PageTitle, PayShell, StatusBadge } from "@/components/ui/Surfaces";
import { formatMoney } from "@/lib/format/money";
import { findPublicPayment } from "@/lib/payments/lookup";
import { referenceSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment not completed",
  robots: { index: false, follow: false },
};

const COPY: Record<string, { title: string; description: string }> = {
  FAILED: {
    title: "Payment failed",
    description:
      "Your payment could not be completed. Nothing has been charged for this attempt — you can try again.",
  },
  ABANDONED: {
    title: "Payment not completed",
    description:
      "This checkout was closed before it finished, so no payment was taken. You can start again whenever you're ready.",
  },
  REVERSED: {
    title: "Payment reversed",
    description:
      "This payment was reversed by the payment provider. If money left your account, contact the college office with your reference.",
  },
  REFUNDED: {
    title: "Payment refunded",
    description: "This payment has been refunded. Your dues are recorded as outstanding again.",
  },
};

export default async function PaymentFailedPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const params = await searchParams;
  const parsed = referenceSchema.safeParse(params.reference ?? "");
  if (!parsed.success) redirect("/pay");

  const payment = await findPublicPayment(parsed.data);
  if (!payment) redirect("/pay");

  if (payment.status === "SUCCESS") {
    redirect(`/payment/success?reference=${encodeURIComponent(payment.reference)}`);
  }
  if (payment.status === "PENDING") {
    redirect(`/payment/pending?reference=${encodeURIComponent(payment.reference)}`);
  }

  const copy = COPY[payment.status] ?? COPY.FAILED;

  return (
    <PayShell>
      <PageTitle eyebrow="Payment status" title={copy.title} description={copy.description} />

      <Card>
        <div className="mb-5 flex items-center justify-between gap-3">
          <span className="text-[13px] text-muted">Current status</span>
          <StatusBadge status={payment.status} />
        </div>

        <dl>
          <DetailRow label="Amount" value={formatMoney(payment.amount, payment.currency)} emphasis />
          <DetailRow label="Full name" value={payment.fullName} />
          <DetailRow label="Matric number" value={payment.matricNumber} mono />
          <DetailRow label="Academic session" value={payment.sessionName} />
          <DetailRow label="Payment reference" value={payment.reference} mono />
        </dl>

        <div className="mt-6 flex flex-col gap-3">
          <ButtonLink href="/pay" size="lg" className="w-full">
            Try again
          </ButtonLink>

          <form action={recheckPaymentAction}>
            <input type="hidden" name="reference" value={payment.reference} />
            <button
              type="submit"
              className="min-h-[44px] w-full text-[14px] font-semibold text-pine-700 hover:underline"
            >
              I have paid — check this reference again
            </button>
          </form>
        </div>
      </Card>

      <div className="mt-5">
        <Notice tone="info" title="Charged but seeing this page?">
          Do not pay again. Contact the college office with your payment reference{" "}
          <span className="font-mono text-ink">{payment.reference}</span> and we will reconcile it.
        </Notice>
      </div>
    </PayShell>
  );
}
