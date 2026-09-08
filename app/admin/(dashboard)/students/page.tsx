import Link from "next/link";

import { AdminCard, AdminPageHeader, EmptyState } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { levelLabel, type LevelCode } from "@/lib/format/level";
import { formatMoney } from "@/lib/format/money";
import { normaliseMatric } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

/**
 * Student records, derived from payments.
 *
 * There is no student account system — students never sign in — so rather than
 * inventing a fake one, this page groups the payment records the college
 * actually holds. Each row is "everything we know about this matric number",
 * which is exactly what a finance officer needs when a student walks in.
 */
export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdminPage("payments:read", "/admin/students");
  const params = await searchParams;

  const query = (params.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, Math.min(10_000, Number(params.page) || 1));

  const where = query
    ? {
        OR: [
          { matricNormal: { contains: normaliseMatric(query) } },
          { fullName: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  // One row per student: their latest submitted details plus paid/owed totals.
  const [groups, totalGroups] = await Promise.all([
    prisma.payment.groupBy({
      by: ["matricNormal"],
      where,
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: "desc" } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.payment.groupBy({ by: ["matricNormal"], where, _count: { _all: true } }),
  ]);

  const matrics = groups.map((group) => group.matricNormal);

  // Latest payment per student, and their successful totals — two queries in
  // total regardless of how many students are on the page.
  const [latestPayments, successTotals] = await Promise.all([
    matrics.length
      ? prisma.payment.findMany({
          where: { matricNormal: { in: matrics } },
          orderBy: { createdAt: "desc" },
          distinct: ["matricNormal"],
          select: {
            id: true,
            matricNormal: true,
            matricNumber: true,
            fullName: true,
            departmentName: true,
            level: true,
            sessionName: true,
            email: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    matrics.length
      ? prisma.payment.groupBy({
          by: ["matricNormal"],
          where: { matricNormal: { in: matrics }, status: "SUCCESS" },
          _sum: { amount: true },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const latestByMatric = new Map(latestPayments.map((payment) => [payment.matricNormal, payment]));
  const paidByMatric = new Map(
    successTotals.map((row) => [row.matricNormal, { sum: row._sum.amount ?? 0, count: row._count._all }]),
  );

  const pages = Math.max(1, Math.ceil(totalGroups.length / PAGE_SIZE));

  return (
    <>
      <AdminPageHeader
        title="Students"
        description="Built from submitted payments. These details were supplied by students and have not been checked against an official university record."
      />

      <AdminCard>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label htmlFor="q" className="mb-1 block text-[12px] font-semibold text-muted">
              Search by matric number or name
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="2023/123456 or John Doe"
              className="min-h-[42px] w-full rounded-lg border border-line bg-white px-3 text-[14px] text-ink outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/20"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-[42px] items-center rounded-lg bg-pine-700 px-4 text-[13.5px] font-semibold text-white hover:bg-pine-800"
          >
            Search
          </button>
          {query ? (
            <Link
              href="/admin/students"
              className="inline-flex min-h-[42px] items-center rounded-lg border border-line px-4 text-[13.5px] font-semibold text-ink hover:border-ink/30"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </AdminCard>

      <div className="mt-4">
        <AdminCard>
          {groups.length === 0 ? (
            <EmptyState
              title={query ? "No students match that search" : "No student records yet"}
              description={
                query
                  ? "Try a different matric number or name."
                  : "Records appear here as soon as students start paying."
              }
            />
          ) : (
            <>
              <div className="-mx-5 overflow-x-auto px-5">
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <caption className="sr-only">Students who have started a dues payment</caption>
                  <thead>
                    <tr className="border-b border-line text-[11.5px] uppercase tracking-wide text-muted">
                      <th scope="col" className="py-2 pr-3 font-semibold">Student</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Department</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Level</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Attempts</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Paid</th>
                      <th scope="col" className="py-2 font-semibold">Latest activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => {
                      const latest = latestByMatric.get(group.matricNormal);
                      const paid = paidByMatric.get(group.matricNormal);
                      if (!latest) return null;

                      return (
                        <tr key={group.matricNormal} className="border-b border-line/60 last:border-0">
                          <td className="py-2.5 pr-3">
                            <Link
                              href={`/admin/payments?q=${encodeURIComponent(latest.matricNumber)}`}
                              className="text-[13.5px] font-semibold text-pine-700 hover:underline"
                            >
                              {latest.fullName}
                            </Link>
                            <span className="block font-mono text-[11.5px] text-muted">
                              {latest.matricNumber}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-[13px] text-ink">{latest.departmentName}</td>
                          <td className="py-2.5 pr-3 text-[13px] text-ink">
                            {levelLabel(latest.level as LevelCode)}
                          </td>
                          <td className="py-2.5 pr-3 text-[13px] tabular-nums text-muted">
                            {group._count._all}
                          </td>
                          <td className="py-2.5 pr-3">
                            {paid && paid.count > 0 ? (
                              <span className="text-[13.5px] font-semibold tabular-nums text-pine-800">
                                {formatMoney(paid.sum)}
                              </span>
                            ) : (
                              <span className="text-[12.5px] font-semibold text-amber-700">
                                Outstanding
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-[12.5px] text-muted">
                            {latest.sessionName} ·{" "}
                            {group._max.createdAt
                              ? group._max.createdAt.toISOString().slice(0, 10)
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <nav
                aria-label="Students pagination"
                className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4"
              >
                <p className="text-[12.5px] text-muted">
                  {totalGroups.length.toLocaleString("en-NG")} students · page {page} of {pages}
                </p>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link
                      href={`/admin/students?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(page - 1) })}`}
                      className="inline-flex min-h-[36px] items-center rounded-lg border border-line px-3 text-[13px] font-semibold text-ink hover:border-ink/30"
                    >
                      Previous
                    </Link>
                  ) : null}
                  {page < pages ? (
                    <Link
                      href={`/admin/students?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(page + 1) })}`}
                      className="inline-flex min-h-[36px] items-center rounded-lg border border-line px-3 text-[13px] font-semibold text-ink hover:border-ink/30"
                    >
                      Next
                    </Link>
                  ) : null}
                </div>
              </nav>
            </>
          )}
        </AdminCard>
      </div>
    </>
  );
}
