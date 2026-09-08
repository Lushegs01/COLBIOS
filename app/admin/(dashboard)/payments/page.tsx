import Link from "next/link";

import { AdminCard, AdminPageHeader, EmptyState } from "@/components/admin/AdminShell";
import { StatusBadge } from "@/components/ui/Surfaces";
import { PAGE_SIZE, findPayments } from "@/lib/admin/payments-query";
import { requireAdminPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { LEVEL_CODES, levelLabel, type LevelCode } from "@/lib/format/level";
import { formatMoney } from "@/lib/format/money";
import { PAYMENT_STATUSES, type PaymentStatusValue } from "@/lib/payments/state";
import { paymentFilterSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage("payments:read", "/admin/payments");
  const raw = await searchParams;

  // Unknown or malformed filters fall back to the defaults rather than erroring:
  // a hand-edited URL should not be able to break the page.
  const parsed = paymentFilterSchema.safeParse(flatten(raw));
  const filter = parsed.success ? parsed.data : paymentFilterSchema.parse({});

  const [{ rows, total, page, pages }, sessions, departments] = await Promise.all([
    findPayments(filter),
    prisma.academicSession.findMany({ orderBy: { name: "desc" }, select: { id: true, name: true } }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const exportQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(flatten(raw))) {
    if (value && key !== "page") exportQuery.set(key, value);
  }

  return (
    <>
      <AdminPageHeader
        title="Payments"
        description={`${total.toLocaleString("en-NG")} ${total === 1 ? "payment" : "payments"} match these filters.`}
        actions={
          <a
            href={`/api/admin/payments/export?${exportQuery.toString()}`}
            className="inline-flex min-h-[38px] items-center rounded-lg border border-line bg-white px-3 text-[13px] font-semibold text-ink hover:border-ink/30"
          >
            Export CSV
          </a>
        }
      />

      <AdminCard>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Labelled label="Search" htmlFor="q" className="sm:col-span-2">
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={filter.q ?? ""}
              placeholder="Reference, matric number or name"
              className="min-h-[42px] w-full rounded-lg border border-line bg-white px-3 text-[14px] text-ink outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/20"
            />
          </Labelled>

          <Labelled label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={filter.status ?? ""} placeholder="Any status">
              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0) + status.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </Labelled>

          <Labelled label="Session" htmlFor="sessionId">
            <Select id="sessionId" name="sessionId" defaultValue={filter.sessionId ?? ""} placeholder="Any session">
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </Select>
          </Labelled>

          <Labelled label="Level" htmlFor="level">
            <Select id="level" name="level" defaultValue={filter.level ?? ""} placeholder="Any level">
              {LEVEL_CODES.map((level) => (
                <option key={level} value={level}>
                  {levelLabel(level)}
                </option>
              ))}
            </Select>
          </Labelled>

          <Labelled label="Department" htmlFor="departmentId">
            <Select
              id="departmentId"
              name="departmentId"
              defaultValue={filter.departmentId ?? ""}
              placeholder="Any department"
            >
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </Labelled>

          <Labelled label="From" htmlFor="from">
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={filter.from ?? ""}
              className="min-h-[42px] w-full rounded-lg border border-line bg-white px-3 text-[14px] text-ink outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/20"
            />
          </Labelled>

          <Labelled label="To" htmlFor="to">
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={filter.to ?? ""}
              className="min-h-[42px] w-full rounded-lg border border-line bg-white px-3 text-[14px] text-ink outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/20"
            />
          </Labelled>

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              className="inline-flex min-h-[42px] items-center rounded-lg bg-pine-700 px-4 text-[13.5px] font-semibold text-white hover:bg-pine-800"
            >
              Apply filters
            </button>
            <Link
              href="/admin/payments"
              className="inline-flex min-h-[42px] items-center rounded-lg border border-line px-4 text-[13.5px] font-semibold text-ink hover:border-ink/30"
            >
              Reset
            </Link>
          </div>
        </form>
      </AdminCard>

      <div className="mt-4">
        <AdminCard>
          {rows.length === 0 ? (
            <EmptyState
              title="No payments found"
              description="Try widening the filters, or clear them to see every payment."
            />
          ) : (
            <>
              <div className="-mx-5 overflow-x-auto px-5">
                <table className="w-full min-w-[980px] border-collapse text-left">
                  <caption className="sr-only">
                    Payments matching the current filters, most recent first
                  </caption>
                  <thead>
                    <tr className="border-b border-line text-[11.5px] uppercase tracking-wide text-muted">
                      <th scope="col" className="py-2 pr-3 font-semibold">Reference</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Student</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Department</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Level</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Amount</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Status</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Channel</th>
                      <th scope="col" className="py-2 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((payment) => (
                      <tr key={payment.id} className="border-b border-line/60 last:border-0">
                        <td className="py-2.5 pr-3">
                          <Link
                            href={`/admin/payments/${payment.id}`}
                            className="font-mono text-[12.5px] font-semibold text-pine-700 hover:underline"
                          >
                            {payment.reference}
                          </Link>
                          {payment.isManualAdjustment ? (
                            <span className="mt-0.5 block text-[10.5px] font-bold uppercase tracking-wide text-amber-700">
                              Manual
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="block text-[13.5px] font-medium text-ink">
                            {payment.fullName}
                          </span>
                          <span className="block font-mono text-[11.5px] text-muted">
                            {payment.matricNumber}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-[13px] text-ink">{payment.departmentName}</td>
                        <td className="py-2.5 pr-3 text-[13px] text-ink">
                          {levelLabel(payment.level as LevelCode)}
                        </td>
                        <td className="py-2.5 pr-3 text-[13.5px] font-semibold tabular-nums text-ink">
                          {formatMoney(payment.amount, payment.currency)}
                        </td>
                        <td className="py-2.5 pr-3">
                          <StatusBadge status={payment.status as PaymentStatusValue} />
                        </td>
                        <td className="py-2.5 pr-3 text-[13px] text-muted">
                          {payment.channel ?? "—"}
                        </td>
                        <td className="py-2.5 text-[12.5px] text-muted">
                          {dateFormatter.format(payment.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination page={page} pages={pages} total={total} params={flatten(raw)} />
            </>
          )}
        </AdminCard>
      </div>
    </>
  );
}

function Pagination({
  page,
  pages,
  total,
  params,
}: {
  page: number;
  pages: number;
  total: number;
  params: Record<string, string>;
}) {
  const link = (target: number) => {
    const query = new URLSearchParams(params);
    query.set("page", String(target));
    return `/admin/payments?${query.toString()}`;
  };

  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <nav
      aria-label="Payments pagination"
      className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4"
    >
      <p className="text-[12.5px] text-muted">
        Showing {first.toLocaleString("en-NG")}–{last.toLocaleString("en-NG")} of{" "}
        {total.toLocaleString("en-NG")}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={link(page - 1)}
            className="inline-flex min-h-[36px] items-center rounded-lg border border-line px-3 text-[13px] font-semibold text-ink hover:border-ink/30"
          >
            Previous
          </Link>
        ) : null}
        <span className="text-[12.5px] text-muted">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link
            href={link(page + 1)}
            className="inline-flex min-h-[36px] items-center rounded-lg border border-line px-3 text-[13px] font-semibold text-ink hover:border-ink/30"
          >
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

function Labelled({
  label,
  htmlFor,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-[12px] font-semibold text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function Select({
  id,
  name,
  defaultValue,
  placeholder,
  children,
}: {
  id: string;
  name: string;
  defaultValue: string;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      className="min-h-[42px] w-full rounded-lg border border-line bg-white px-3 text-[14px] text-ink outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/20"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

function flatten(params: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) out[key] = first;
  }
  return out;
}
