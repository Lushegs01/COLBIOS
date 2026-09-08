import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/ui/Button";
import { Card, DetailRow, Notice, PageTitle, PayShell, StatusBadge } from "@/components/ui/Surfaces";
import { formatMoney } from "@/lib/format/money";
import { findPublicPayment, toVerificationView } from "@/lib/payments/lookup";
import { RATE_LIMITS, checkRateLimit, clientIdentifier } from "@/lib/rate-limit/limiter";
import { referenceSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify COLBIOS payment",
  description: "Check whether a COLBIOS dues payment receipt is genuine.",
  robots: { index: false, follow: false },
};

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "long",
  timeZone: "Africa/Lagos",
});

/**
 * Public receipt verification — what the QR code on a receipt points to.
 *
 * Anyone holding a reference can check it, so the page is deliberately thin on
 * detail: name, masked matric number, level, session, amount and status. No
 * email address, no database ids, no provider data, no admin fields.
 *
 * It is rate limited, and an unknown reference produces the same 404 as a
 * malformed one, so the endpoint cannot be walked to discover valid references.
 */
export default async function VerifyPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const limit = await checkRateLimit(RATE_LIMITS.publicLookup, clientIdentifier(await headers()));
  if (!limit.allowed) {
    return (
      <PayShell>
        <PageTitle title="Too many attempts" />
        <Card>
          <Notice tone="warning" title="Please slow down">
            Too many verification attempts from this connection. Try again in a few minutes.
          </Notice>
        </Card>
      </PayShell>
    );
  }

  const { reference: raw } = await params;
  const parsed = referenceSchema.safeParse(decodeURIComponent(raw));
  if (!parsed.success) notFound();

  const payment = await findPublicPayment(parsed.data);
  if (!payment) notFound();

  const view = toVerificationView(payment);

  return (
    <PayShell>
      <div className="mb-6">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
          Payment verification
        </p>
        <h1 className="flex items-center gap-2.5 text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[30px]">
          {view.verified ? (
            <>
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pine-100 text-pine-700"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              Payment verified
            </>
          ) : (
            <>
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 8v5M12 16.5v.5" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </span>
              Not verified
            </>
          )}
        </h1>
        <p className="mt-2.5 text-[15px] leading-relaxed text-muted">
          {view.verified
            ? "This reference matches a COLBIOS dues payment that was confirmed with the payment provider."
            : "This reference exists, but no verified payment is recorded against it."}
        </p>
      </div>

      <Card>
        <div className="mb-5 flex items-center justify-between gap-3">
          <span className="text-[13px] text-muted">Status</span>
          <StatusBadge status={view.status} />
        </div>

        <dl>
          <DetailRow label="Fee" value={view.feeName} />
          <DetailRow label="Amount" value={formatMoney(view.amount, view.currency)} emphasis />
          <DetailRow label="Student" value={view.fullName} />
          <DetailRow label="Matric number" value={view.maskedMatric} mono />
          <DetailRow label="Department" value={view.department} />
          <DetailRow label="Level" value={view.levelLabel} />
          <DetailRow label="Academic session" value={view.sessionName} />
          <DetailRow label="Payment reference" value={view.reference} mono />
          {view.receiptNumber ? (
            <DetailRow label="Receipt number" value={view.receiptNumber} mono />
          ) : null}
          {view.paidAt ? (
            <DetailRow label="Payment date" value={dateFormatter.format(view.paidAt)} />
          ) : null}
        </dl>

        {view.isManualAdjustment ? (
          <div className="mt-5">
            <Notice tone="warning" title="Recorded by the college, not by Paystack">
              This payment was recorded manually by an authorised administrator rather than
              collected through Paystack.
            </Notice>
          </div>
        ) : null}
      </Card>

      <p className="mt-5 text-center text-[12.5px] leading-relaxed text-muted">
        Part of the matric number is hidden for privacy. To confirm the full details, contact the
        College of Biosciences office with this reference.
      </p>

      <div className="mt-4 text-center">
        <ButtonLink href="/pay" variant="ghost" size="sm">
          Pay COLBIOS dues
        </ButtonLink>
      </div>
    </PayShell>
  );
}
