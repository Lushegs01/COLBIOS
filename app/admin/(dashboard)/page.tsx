import Link from "next/link";

import { AdminCard, AdminPageHeader, EmptyState } from "@/components/admin/AdminShell";
import { BreakdownBars, PaymentsBarChart, RevenueChart, StatTile } from "@/components/admin/Charts";
import { StatusBadge } from "@/components/ui/Surfaces";
import {
  getChannelBreakdown,
  getDailySeries,
  getDashboardStats,
  getLevelBreakdown,
  getRecentPayments,
} from "@/lib/admin/analytics";
import { requireAdminPage } from "@/lib/auth/guard";
import { levelLabel, type LevelCode } from "@/lib/format/level";
import { formatMoney } from "@/lib/format/money";
import { getActiveSession } from "@/lib/payments/config";
import type { PaymentStatusValue } from "@/lib/payments/state";

export const dynamic = "force-dynamic";

const RANGE_OPTIONS = [7, 30, 90] as const;

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; denied?: string }>;
}) {
  await requireAdminPage("payments:read", "/admin");
  const params = await searchParams;

  const days = RANGE_OPTIONS.includes(Number(params.days) as (typeof RANGE_OPTIONS)[number])
    ? Number(params.days)
    : 30;

  const session = await getActiveSession();
  const sessionId = session?.id ?? null;

  const [stats, series, channels, levels, recent] = await Promise.all([
    getDashboardStats(sessionId),
    getDailySeries(sessionId, days),
    getChannelBreakdown(sessionId),
    getLevelBreakdown(sessionId),
    getRecentPayments(8),
  ]);

  const collectionRate =
    stats.totalExpectedMinor > 0
      ? Math.round((stats.totalCollectedMinor / stats.totalExpectedMinor) * 100)
      : 0;

  return (
    <>
      <AdminPageHeader
        title="Overview"
        description={
          session
            ? `Active session ${session.name}.`
            : "No academic session is active — students cannot pay right now."
        }
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-line bg-white p-1">
            {RANGE_OPTIONS.map((option) => (
              <Link
                key={option}
                href={`/admin?days=${option}`}
                className={`rounded-md px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                  option === days ? "bg-pine-700 text-white" : "text-muted hover:text-ink"
                }`}
              >
                {option}d
              </Link>
            ))}
          </div>
        }
      />

      {params.denied ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] font-medium text-amber-900">
          You do not have permission to open that page.
        </div>
      ) : null}

      {!session ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] text-amber-900">
          <span className="font-semibold">No active academic session.</span> Students see a
          &ldquo;payment not open&rdquo; message until one is activated under{" "}
          <Link href="/admin/sessions" className="underline">
            Sessions
          </Link>
          .
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Total collected"
          value={formatMoney(stats.totalCollectedMinor, stats.currency)}
          hint="Verified payments only"
          tone="positive"
        />
        <StatTile
          label="Total expected"
          value={formatMoney(stats.totalExpectedMinor, stats.currency)}
          hint="From students who have started"
        />
        <StatTile
          label="Paid students"
          value={String(stats.paidStudents)}
          hint={`${collectionRate}% of expected collected`}
        />
        <StatTile
          label="Outstanding students"
          value={String(stats.outstandingStudents)}
          hint="Started but not completed"
          tone={stats.outstandingStudents > 0 ? "warning" : "default"}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="All payments" value={String(stats.total)} />
        <StatTile label="Successful" value={String(stats.byStatus.SUCCESS)} />
        <StatTile label="Pending" value={String(stats.byStatus.PENDING)} />
        <StatTile label="Failed" value={String(stats.byStatus.FAILED + stats.byStatus.ABANDONED)} />
        <StatTile
          label="Refunded / reversed"
          value={String(stats.byStatus.REFUNDED + stats.byStatus.REVERSED)}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <AdminCard title="Revenue over time" description={`Verified payments, last ${days} days`}>
          <RevenueChart series={series} currency={stats.currency} />
        </AdminCard>

        <AdminCard title="Payments over time" description={`Successful payments, last ${days} days`}>
          <PaymentsBarChart series={series} />
        </AdminCard>

        <AdminCard title="Payment methods" description="Share of collected funds by channel">
          <BreakdownBars rows={channels} currency={stats.currency} />
        </AdminCard>

        <AdminCard title="Collections by level" description="Verified payments by academic level">
          <BreakdownBars rows={levels} currency={stats.currency} />
        </AdminCard>
      </div>

      <div className="mt-4">
        <AdminCard
          title="Recent transactions"
          actions={
            <Link
              href="/admin/payments"
              className="text-[13px] font-semibold text-pine-700 hover:underline"
            >
              View all payments
            </Link>
          }
        >
          {recent.length === 0 ? (
            <EmptyState
              title="No payments yet"
              description="Payments will appear here as soon as students start paying."
            />
          ) : (
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-[11.5px] uppercase tracking-wide text-muted">
                    <th scope="col" className="py-2 pr-3 font-semibold">Reference</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Student</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Level</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Amount</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Status</th>
                    <th scope="col" className="py-2 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((payment) => (
                    <tr key={payment.id} className="border-b border-line/60 last:border-0">
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/admin/payments/${payment.id}`}
                          className="font-mono text-[12.5px] font-semibold text-pine-700 hover:underline"
                        >
                          {payment.reference}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="block text-[13.5px] font-medium text-ink">
                          {payment.fullName}
                        </span>
                        <span className="block font-mono text-[11.5px] text-muted">
                          {payment.matricNumber}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-[13px] text-ink">
                        {levelLabel(payment.level as LevelCode)}
                      </td>
                      <td className="py-2.5 pr-3 text-[13.5px] font-semibold tabular-nums text-ink">
                        {formatMoney(payment.amount, payment.currency)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge status={payment.status as PaymentStatusValue} />
                      </td>
                      <td className="py-2.5 text-[12.5px] text-muted">
                        {dateFormatter.format(payment.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>
      </div>
    </>
  );
}
