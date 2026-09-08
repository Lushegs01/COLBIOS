import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/pay/PrintButton";
import { ButtonLink } from "@/components/ui/Button";
import { Notice, PayFooter, PayHeader, StatusBadge } from "@/components/ui/Surfaces";
import { absoluteUrl } from "@/lib/env";
import { formatMoney } from "@/lib/format/money";
import { findPublicPayment } from "@/lib/payments/lookup";
import { qrDataUrl } from "@/lib/receipts/pdf";
import { referenceSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "COLBIOS Dues Receipt",
  robots: { index: false, follow: false },
};

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

/**
 * The on-screen receipt.
 *
 * Only a payment that has actually been verified gets a receipt document; for
 * any other status the page says plainly that no receipt exists rather than
 * rendering something that looks like proof of payment.
 */
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference: raw } = await params;
  const parsed = referenceSchema.safeParse(decodeURIComponent(raw));
  if (!parsed.success) notFound();

  const payment = await findPublicPayment(parsed.data);
  if (!payment) notFound();

  const verifyUrl = absoluteUrl(`/verify/${payment.reference}`);

  if (payment.status !== "SUCCESS" || !payment.receiptNumber) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <PayHeader />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
          <h1 className="mb-4 text-[26px] font-bold tracking-tight text-ink">No receipt yet</h1>
          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-[13px] text-muted">Payment status</span>
              <StatusBadge status={payment.status} />
            </div>
            <Notice tone="warning" title="This payment has not been verified">
              A receipt is only issued after the payment provider confirms a payment. Reference{" "}
              <span className="font-mono text-ink">{payment.reference}</span> is currently{" "}
              {payment.status.toLowerCase()}.
            </Notice>
            <div className="mt-5">
              <ButtonLink
                href={`/payment/${payment.status === "PENDING" ? "pending" : "failed"}?reference=${encodeURIComponent(payment.reference)}`}
                size="lg"
                className="w-full"
              >
                Check payment status
              </ButtonLink>
            </div>
          </div>
        </main>
        <PayFooter />
      </div>
    );
  }

  const qr = await qrDataUrl(verifyUrl);
  const paidAt = payment.paidAt ?? payment.receiptIssuedAt;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="print:hidden">
        <PayHeader />
      </div>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-5 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-[22px] font-bold tracking-tight text-ink">Payment receipt</h1>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/receipt/${payment.reference}/pdf`} variant="secondary" size="sm">
              Download PDF
            </ButtonLink>
            <PrintButton />
            <ButtonLink href={`/verify/${payment.reference}`} variant="secondary" size="sm">
              Verify payment
            </ButtonLink>
          </div>
        </div>

        {/* The receipt document itself. Styled to print cleanly on A4. */}
        <article className="rounded-2xl border border-line bg-white p-6 shadow-soft print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-9">
          <header className="flex items-start justify-between gap-4 border-b-2 border-pine-700 pb-5">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-pine-700 text-[13px] font-bold text-white"
              >
                CB
              </span>
              <div>
                <p className="text-[17px] font-bold leading-tight tracking-tight text-ink">COLBIOS</p>
                <p className="text-[12px] leading-snug text-muted">College of Biosciences</p>
                <p className="text-[12px] leading-snug text-muted">
                  Federal University of Agriculture, Abeokuta
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-pine-300 bg-pine-50 px-2.5 py-1 text-[11px] font-bold text-pine-800">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-pine-600" />
                PAYMENT VERIFIED
              </span>
              <p className="mt-2 font-mono text-[11px] text-muted">{payment.receiptNumber}</p>
            </div>
          </header>

          <div className="mt-6">
            <h2 className="text-[20px] font-bold tracking-tight text-ink">Payment Receipt</h2>
            <p className="text-[13px] text-muted">Academic session {payment.sessionName}</p>
          </div>

          <section className="mt-6">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              Student particulars
            </h3>
            <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <Particular label="Full name" value={payment.fullName} />
              <Particular label="Matric number" value={payment.matricNumber} mono />
              <Particular label="Department" value={payment.department} />
              <Particular label="Level" value={payment.levelLabel} />
            </dl>
          </section>

          <section className="mt-7 border-t border-line pt-6">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              Payment particulars
            </h3>

            <div className="mt-3 flex items-end justify-between gap-4 rounded-xl border border-line bg-background px-4 py-4">
              <div>
                <p className="text-[13px] text-muted">{payment.feeName}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-muted">Amount paid</p>
              </div>
              <p className="text-[26px] font-bold leading-none tracking-tight text-pine-800">
                {formatMoney(payment.amount, payment.currency)}
              </p>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <Particular label="Payment reference" value={payment.reference} mono />
              <Particular label="Receipt number" value={payment.receiptNumber} mono />
              <Particular
                label="Payment date"
                value={paidAt ? dateFormatter.format(paidAt) : "—"}
              />
              <Particular label="Payment channel" value={formatChannel(payment.channel)} />
              <Particular label="Academic session" value={payment.sessionName} />
              <Particular
                label="Payment method"
                value={payment.isManualAdjustment ? "Manual adjustment (not Paystack)" : "Paystack"}
              />
            </dl>
          </section>

          <section className="mt-7 flex items-center gap-4 rounded-xl border border-line p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt={`QR code linking to the verification page for receipt ${payment.receiptNumber}`}
              width={92}
              height={92}
              className="h-[92px] w-[92px] shrink-0"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                Verify this receipt
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink">
                Scan the code, or open the link below, to confirm this payment against COLBIOS
                records.
              </p>
              <p className="mt-1 break-all font-mono text-[11.5px] font-semibold text-pine-700">
                {verifyUrl}
              </p>
            </div>
          </section>

          <footer className="mt-7 border-t border-line pt-4 text-[11px] leading-relaxed text-muted">
            <p>
              Issued electronically by the College of Biosciences, FUNAAB. No signature is required.
            </p>
            <p>This receipt is valid only if it can be verified at the address above.</p>
          </footer>
        </article>
      </main>

      <div className="print:hidden">
        <PayFooter />
      </div>
    </div>
  );
}

function Particular({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd
        className={`mt-0.5 break-words text-[14.5px] font-semibold text-ink ${
          mono ? "font-mono text-[13px]" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function formatChannel(channel: string | null): string {
  if (!channel) return "—";
  return channel
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
