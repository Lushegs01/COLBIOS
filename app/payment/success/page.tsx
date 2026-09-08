import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ButtonLink } from "@/components/ui/Button";
import { Card, DetailRow, PayShell } from "@/components/ui/Surfaces";
import { formatMoney } from "@/lib/format/money";
import { findPublicPayment } from "@/lib/payments/lookup";
import { referenceSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment successful",
  robots: { index: false, follow: false },
};

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

/**
 * Shown only for a payment that is genuinely SUCCESS in our database — which
 * only happens after Paystack has confirmed it server-side. Landing on this URL
 * with any other reference redirects to the state that is actually true.
 */
export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const { reference: raw } = await searchParams;
  const parsed = referenceSchema.safeParse(raw ?? "");
  if (!parsed.success) redirect("/pay");

  const payment = await findPublicPayment(parsed.data);
  if (!payment) redirect("/pay");

  if (payment.status !== "SUCCESS") {
    const destination = ["FAILED", "ABANDONED"].includes(payment.status) ? "failed" : "pending";
    redirect(`/payment/${destination}?reference=${encodeURIComponent(payment.reference)}`);
  }

  return (
    <PayShell>
      <div className="mb-6 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-pine-100 text-pine-700"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-pine-700">
            Payment verified
          </p>
          <h1 className="text-[24px] font-bold leading-tight tracking-tight text-ink sm:text-[28px]">
            Payment successful
          </h1>
        </div>
      </div>

      <p className="mb-6 text-[15px] leading-relaxed text-muted">
        Your COLBIOS dues payment has been confirmed with the payment provider. A confirmation and
        receipt have been sent to {payment.email}.
      </p>

      <Card>
        <div className="mb-5 rounded-xl border border-pine-200 bg-pine-50 p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-pine-800">
            Amount paid
          </p>
          <p className="mt-0.5 text-[30px] font-bold leading-none tracking-tight text-pine-900">
            {formatMoney(payment.amount, payment.currency)}
          </p>
        </div>

        <dl>
          <DetailRow label="Full name" value={payment.fullName} />
          <DetailRow label="Matric number" value={payment.matricNumber} mono />
          <DetailRow label="Department" value={payment.department} />
          <DetailRow label="Level" value={payment.levelLabel} />
          <DetailRow label="Academic session" value={payment.sessionName} />
          <DetailRow label="Payment reference" value={payment.reference} mono />
          {payment.receiptNumber ? (
            <DetailRow label="Receipt number" value={payment.receiptNumber} mono />
          ) : null}
          {payment.paidAt ? (
            <DetailRow label="Payment date" value={dateFormatter.format(payment.paidAt)} />
          ) : null}
        </dl>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={`/receipt/${payment.reference}`} size="lg" className="sm:flex-1">
            View receipt
          </ButtonLink>
          <ButtonLink
            href={`/verify/${payment.reference}`}
            variant="secondary"
            size="lg"
            className="sm:flex-1"
          >
            Verify payment
          </ButtonLink>
        </div>
      </Card>

      <p className="mt-5 text-center text-[12.5px] leading-relaxed text-muted">
        Keep your payment reference. You can return to your receipt at any time using the link
        above.
      </p>
    </PayShell>
  );
}
