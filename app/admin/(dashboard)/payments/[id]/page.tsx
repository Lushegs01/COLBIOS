import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminCard, AdminPageHeader } from "@/components/admin/AdminShell";
import PaymentAdminActions from "@/components/admin/PaymentAdminActions";
import { StatusBadge } from "@/components/ui/Surfaces";
import { requireAdminPage, roleHasPermission } from "@/lib/auth/guard";
import { currentCsrfToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { levelLabel, type LevelCode } from "@/lib/format/level";
import { formatMoney } from "@/lib/format/money";
import type { PaymentStatusValue } from "@/lib/payments/state";
import { cuidSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Africa/Lagos",
});

export default async function AdminPaymentDetailPage(
  props: PageProps<"/admin/payments/[id]">,
) {
  const { id } = await props.params;
  const admin = await requireAdminPage("payments:read", `/admin/payments/${id}`);

  const parsedId = cuidSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const payment = await prisma.payment.findUnique({
    where: { id: parsedId.data },
    include: {
      receipt: true,
      manualAdjustedBy: { select: { email: true, name: true } },
      events: { orderBy: { createdAt: "asc" }, take: 50 },
    },
  });

  if (!payment) notFound();

  const csrf = await currentCsrfToken();
  const canAdjust = roleHasPermission(admin.role, "payments:adjust");

  const timeline = buildTimeline(payment);

  return (
    <>
      <AdminPageHeader
        title={payment.reference}
        description={`${payment.feeName} · ${payment.sessionName}`}
        actions={
          <>
            <Link
              href="/admin/payments"
              className="inline-flex min-h-[38px] items-center rounded-lg border border-line bg-white px-3 text-[13px] font-semibold text-ink hover:border-ink/30"
            >
              Back to payments
            </Link>
            {payment.status === "SUCCESS" ? (
              <Link
                href={`/receipt/${payment.reference}`}
                className="inline-flex min-h-[38px] items-center rounded-lg border border-line bg-white px-3 text-[13px] font-semibold text-ink hover:border-ink/30"
              >
                View receipt
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <AdminCard title="Payment details">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <StatusBadge status={payment.status as PaymentStatusValue} />
              {payment.isManualAdjustment ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11.5px] font-bold text-amber-900">
                  MANUAL ADJUSTMENT — NOT A PAYSTACK PAYMENT
                </span>
              ) : null}
            </div>

            <dl className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
              <Field label="Amount" value={formatMoney(payment.amount, payment.currency)} strong />
              <Field label="Currency" value={payment.currency} />
              <Field label="Fee" value={payment.feeName} />
              <Field label="Academic session" value={payment.sessionName} />
              <Field label="Payment channel" value={payment.channel ?? "—"} />
              <Field
                label="Paystack transaction ID"
                value={payment.paystackTransactionId ?? "—"}
                mono
              />
              <Field
                label="Payment date"
                value={payment.paidAt ? dateFormatter.format(payment.paidAt) : "—"}
              />
              <Field label="Created" value={dateFormatter.format(payment.createdAt)} />
              <Field label="Receipt number" value={payment.receipt?.receiptNumber ?? "—"} mono />
              <Field
                label="Confirmation email"
                value={
                  payment.confirmationEmailSentAt
                    ? dateFormatter.format(payment.confirmationEmailSentAt)
                    : "Not sent"
                }
              />
              {payment.failureReason ? (
                <Field label="Provider message" value={payment.failureReason} />
              ) : null}
            </dl>
          </AdminCard>

          <AdminCard title="Student details" description="Exactly as submitted by the student">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
              <Field label="Full name" value={payment.fullName} />
              <Field label="Matric number" value={payment.matricNumber} mono />
              <Field label="Department" value={payment.departmentName} />
              <Field label="Level" value={levelLabel(payment.level as LevelCode)} />
              <Field label="Email" value={payment.email} />
            </dl>
            <p className="mt-4 rounded-lg bg-background px-3 py-2 text-[12px] leading-relaxed text-muted">
              These details were supplied by the student at checkout. They have not been checked
              against an official university student record.
            </p>
          </AdminCard>

          {payment.isManualAdjustment && payment.manualReason ? (
            <AdminCard title="Manual adjustment record">
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
                <Field
                  label="Recorded by"
                  value={payment.manualAdjustedBy?.email ?? "Account removed"}
                />
                <Field
                  label="Recorded at"
                  value={
                    payment.manualAdjustedAt ? dateFormatter.format(payment.manualAdjustedAt) : "—"
                  }
                />
              </dl>
              <div className="mt-3">
                <p className="text-[11.5px] text-muted">Reason</p>
                <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
                  {payment.manualReason}
                </p>
              </div>
            </AdminCard>
          ) : null}
        </div>

        <div className="space-y-4">
          <AdminCard title="Lifecycle">
            <ol className="space-y-4">
              {timeline.map((entry) => (
                <li key={entry.key} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      entry.done ? "bg-pine-600" : "bg-line"
                    }`}
                  />
                  <div className="min-w-0">
                    <p
                      className={`text-[13.5px] font-semibold ${
                        entry.done ? "text-ink" : "text-muted"
                      }`}
                    >
                      {entry.label}
                    </p>
                    <p className="text-[12px] text-muted">
                      {entry.at ? dateFormatter.format(entry.at) : entry.done ? "—" : "Not yet"}
                    </p>
                    {entry.detail ? (
                      <p className="mt-0.5 break-words text-[12px] text-muted">{entry.detail}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </AdminCard>

          <PaymentAdminActions
            paymentId={payment.id}
            reference={payment.reference}
            status={payment.status as PaymentStatusValue}
            csrf={csrf}
            canAdjust={canAdjust}
          />
        </div>
      </div>
    </>
  );
}

type TimelineEntry = {
  key: string;
  label: string;
  at: Date | null;
  done: boolean;
  detail?: string;
};

/**
 * The lifecycle is derived from the payment and its provider events rather than
 * stored separately, so it can never disagree with the record it describes.
 */
function buildTimeline(payment: {
  createdAt: Date;
  authorizationUrl: string | null;
  paidAt: Date | null;
  status: string;
  receipt: { issuedAt: Date; receiptNumber: string } | null;
  confirmationEmailSentAt: Date | null;
  events: Array<{ id: string; eventType: string; source: string; createdAt: Date; processed: boolean }>;
}): TimelineEntry[] {
  const webhookEvents = payment.events.filter((event) => event.source === "WEBHOOK");
  const verifyEvents = payment.events.filter((event) => event.source === "VERIFY");

  return [
    { key: "created", label: "Payment created", at: payment.createdAt, done: true },
    {
      key: "checkout",
      label: "Checkout initialised",
      at: payment.authorizationUrl ? payment.createdAt : null,
      done: Boolean(payment.authorizationUrl),
    },
    {
      key: "webhook",
      label: "Webhook received",
      at: webhookEvents[0]?.createdAt ?? null,
      done: webhookEvents.length > 0,
      detail:
        webhookEvents.length > 0
          ? `${webhookEvents.length} event${webhookEvents.length === 1 ? "" : "s"}: ${webhookEvents
              .map((event) => event.eventType)
              .join(", ")}`
          : undefined,
    },
    {
      key: "verified",
      label: "Verified with Paystack",
      at: payment.paidAt,
      done: payment.status === "SUCCESS",
      detail:
        verifyEvents.length > 0 ? "Confirmed by direct verification call" : undefined,
    },
    {
      key: "receipt",
      label: "Receipt issued",
      at: payment.receipt?.issuedAt ?? null,
      done: Boolean(payment.receipt),
      detail: payment.receipt?.receiptNumber,
    },
    {
      key: "email",
      label: "Confirmation email sent",
      at: payment.confirmationEmailSentAt,
      done: Boolean(payment.confirmationEmailSentAt),
    },
  ];
}

function Field({
  label,
  value,
  mono = false,
  strong = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd
        className={`mt-0.5 break-words text-ink ${
          strong ? "text-[17px] font-bold" : "text-[13.5px] font-medium"
        } ${mono ? "font-mono text-[12.5px]" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
