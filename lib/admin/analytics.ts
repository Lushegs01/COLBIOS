import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { LevelCode } from "@/lib/format/level";
import type { PaymentStatusValue } from "@/lib/payments/state";
import { Prisma } from "@/lib/generated/prisma/client";

/**
 * Aggregate queries for the dashboard and reports.
 *
 * All of these are computed in the database — grouped counts and sums, never
 * "fetch every payment and add it up in JavaScript". At a few thousand payments
 * that distinction is the difference between a page that loads and one that
 * times out on a serverless function.
 */

export type DateRange = { from?: Date; to?: Date };

export type DashboardStats = {
  total: number;
  byStatus: Record<PaymentStatusValue, number>;
  totalCollectedMinor: number;
  totalExpectedMinor: number;
  paidStudents: number;
  outstandingStudents: number;
  currency: string;
};

const EMPTY_STATUS_COUNTS: Record<PaymentStatusValue, number> = {
  PENDING: 0,
  SUCCESS: 0,
  FAILED: 0,
  ABANDONED: 0,
  REVERSED: 0,
  REFUNDED: 0,
};

export function rangeFilter(range: DateRange): Prisma.PaymentWhereInput {
  if (!range.from && !range.to) return {};
  return { createdAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } };
}

/**
 * Headline numbers.
 *
 * "Total expected" is the sum of active fees for the session multiplied by the
 * number of distinct students who have engaged with the system — we do not have
 * a student roll, so this is stated as expected *from students who have started
 * a payment*, and the dashboard labels it that way rather than implying we know
 * the size of the cohort.
 */
export async function getDashboardStats(
  sessionId: string | null,
  range: DateRange = {},
): Promise<DashboardStats> {
  const where: Prisma.PaymentWhereInput = {
    ...(sessionId ? { sessionId } : {}),
    ...rangeFilter(range),
  };

  // The same filters, expressed as SQL for the distinct-student aggregates.
  const filters: Prisma.Sql[] = [];
  if (sessionId) filters.push(Prisma.sql`"sessionId" = ${sessionId}`);
  if (range.from) filters.push(Prisma.sql`"createdAt" >= ${range.from}`);
  if (range.to) filters.push(Prisma.sql`"createdAt" <= ${range.to}`);
  const scope = filters.length
    ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`
    : Prisma.empty;

  const [grouped, collected, studentTotals] = await Promise.all([
    prisma.payment.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.payment.aggregate({ where: { ...where, status: "SUCCESS" }, _sum: { amount: true } }),
    /**
     * One row per student who has started a payment: what they owe (the amount
     * on their most recent attempt) and whether they have paid it. Computed in
     * the database so the page cost does not grow with the number of students.
     */
    prisma.$queryRaw<Array<{ students: bigint; paid: bigint; expected: bigint | null }>>`
      WITH per_student AS (
        SELECT DISTINCT ON ("matricNormal")
               "matricNormal",
               "amount",
               EXISTS (
                 SELECT 1 FROM "Payment" p2
                  WHERE p2."matricNormal" = p."matricNormal"
                    AND p2."status" = 'SUCCESS'
                    ${sessionId ? Prisma.sql`AND p2."sessionId" = ${sessionId}` : Prisma.empty}
               ) AS has_paid
          FROM "Payment" p
          ${scope}
         ORDER BY "matricNormal", "createdAt" DESC
      )
      SELECT COUNT(*)                                          AS students,
             COUNT(*) FILTER (WHERE has_paid)                  AS paid,
             SUM("amount")                                     AS expected
        FROM per_student
    `,
  ]);

  const byStatus = { ...EMPTY_STATUS_COUNTS };
  let total = 0;
  for (const row of grouped) {
    byStatus[row.status as PaymentStatusValue] = row._count._all;
    total += row._count._all;
  }

  const totals = studentTotals[0];
  const students = Number(totals?.students ?? 0);
  const paidStudents = Number(totals?.paid ?? 0);

  return {
    total,
    byStatus,
    totalCollectedMinor: collected._sum.amount ?? 0,
    totalExpectedMinor: Number(totals?.expected ?? 0),
    paidStudents,
    outstandingStudents: Math.max(0, students - paidStudents),
    currency: "NGN",
  };
}

export type TimeSeriesPoint = { date: string; count: number; amountMinor: number };

/** Daily successful revenue and payment counts, for the dashboard charts. */
export async function getDailySeries(
  sessionId: string | null,
  days: number,
): Promise<TimeSeriesPoint[]> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const rows = await prisma.$queryRaw<Array<{ day: Date; count: bigint; amount: bigint | null }>>`
    SELECT date_trunc('day', COALESCE("paidAt", "createdAt")) AS day,
           COUNT(*)                                          AS count,
           SUM("amount")                                     AS amount
      FROM "Payment"
     WHERE "status" = 'SUCCESS'
       AND COALESCE("paidAt", "createdAt") >= ${since}
       ${sessionId ? Prisma.sql`AND "sessionId" = ${sessionId}` : Prisma.empty}
     GROUP BY 1
     ORDER BY 1
  `;

  const byDay = new Map<string, { count: number; amount: number }>();
  for (const row of rows) {
    byDay.set(row.day.toISOString().slice(0, 10), {
      count: Number(row.count),
      amount: Number(row.amount ?? 0),
    });
  }

  const series: TimeSeriesPoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = new Date(since);
    date.setUTCDate(since.getUTCDate() + i);
    const key = date.toISOString().slice(0, 10);
    const entry = byDay.get(key);
    series.push({ date: key, count: entry?.count ?? 0, amountMinor: entry?.amount ?? 0 });
  }

  return series;
}

export type BreakdownRow = { key: string; label: string; count: number; amountMinor: number };

export async function getChannelBreakdown(sessionId: string | null): Promise<BreakdownRow[]> {
  const rows = await prisma.payment.groupBy({
    by: ["channel"],
    where: { status: "SUCCESS", ...(sessionId ? { sessionId } : {}) },
    _count: { _all: true },
    _sum: { amount: true },
  });

  return rows
    .map((row) => ({
      key: row.channel ?? "unknown",
      label: formatChannel(row.channel),
      count: row._count._all,
      amountMinor: row._sum.amount ?? 0,
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
}

export async function getLevelBreakdown(sessionId: string | null): Promise<BreakdownRow[]> {
  const rows = await prisma.payment.groupBy({
    by: ["level"],
    where: { status: "SUCCESS", ...(sessionId ? { sessionId } : {}) },
    _count: { _all: true },
    _sum: { amount: true },
  });

  return rows
    .map((row) => ({
      key: row.level,
      label: `${(row.level as LevelCode).slice(1)}L`,
      count: row._count._all,
      amountMinor: row._sum.amount ?? 0,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export async function getDepartmentBreakdown(sessionId: string | null): Promise<BreakdownRow[]> {
  const rows = await prisma.payment.groupBy({
    by: ["departmentName"],
    where: { status: "SUCCESS", ...(sessionId ? { sessionId } : {}) },
    _count: { _all: true },
    _sum: { amount: true },
  });

  return rows
    .map((row) => ({
      key: row.departmentName,
      label: row.departmentName,
      count: row._count._all,
      amountMinor: row._sum.amount ?? 0,
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
}

export async function getRecentPayments(limit = 8) {
  return prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      reference: true,
      fullName: true,
      matricNumber: true,
      departmentName: true,
      level: true,
      amount: true,
      currency: true,
      status: true,
      channel: true,
      createdAt: true,
    },
  });
}

function formatChannel(channel: string | null): string {
  if (!channel) return "Unknown";
  return channel
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
