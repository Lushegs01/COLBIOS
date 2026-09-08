import Link from "next/link";

import { AdminCard, AdminPageHeader, EmptyState } from "@/components/admin/AdminShell";
import { AUDIT_ACTIONS } from "@/lib/audit/log";
import { requireAdminPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Africa/Lagos",
});

/**
 * The audit trail.
 *
 * Read-only by construction: there is no code path in the application that
 * updates or deletes an AuditLog row. Metadata is rendered as formatted JSON so
 * a "from ₦5,000 to ₦6,000" change is legible months later.
 */
export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  await requireAdminPage("audit:read", "/admin/audit-logs");
  const params = await searchParams;

  const page = Math.max(1, Math.min(10_000, Number(params.page) || 1));
  const action = (AUDIT_ACTIONS as readonly string[]).includes(params.action ?? "")
    ? params.action
    : undefined;

  const where: Prisma.AuditLogWhereInput = action ? { action } : {};

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <AdminPageHeader
        title="Audit log"
        description="Every financially significant administrative action, with who did it and when. Entries cannot be edited or removed."
      />

      <AdminCard>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <label htmlFor="action" className="mb-1 block text-[12px] font-semibold text-muted">
              Action
            </label>
            <select
              id="action"
              name="action"
              defaultValue={action ?? ""}
              className="min-h-[42px] w-full rounded-lg border border-line bg-white px-3 text-[14px] text-ink outline-none focus:border-pine-600"
            >
              <option value="">All actions</option>
              {AUDIT_ACTIONS.map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="inline-flex min-h-[42px] items-center rounded-lg bg-pine-700 px-4 text-[13.5px] font-semibold text-white hover:bg-pine-800"
          >
            Filter
          </button>
          {action ? (
            <Link
              href="/admin/audit-logs"
              className="inline-flex min-h-[42px] items-center rounded-lg border border-line px-4 text-[13.5px] font-semibold text-ink hover:border-ink/30"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </AdminCard>

      <div className="mt-4">
        <AdminCard>
          {entries.length === 0 ? (
            <EmptyState title="No audit entries" description="Administrative actions appear here." />
          ) : (
            <>
              <ul className="divide-y divide-line">
                {entries.map((entry) => (
                  <li key={entry.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[13.5px] font-bold text-ink">
                        {entry.action.replace(/_/g, " ")}
                      </p>
                      <p className="text-[12px] text-muted">{dateFormatter.format(entry.createdAt)}</p>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      {entry.adminEmail ?? "system"} · {entry.entityType}
                      {entry.entityId ? ` · ${entry.entityId}` : ""}
                      {entry.ip ? ` · ${entry.ip}` : ""}
                    </p>
                    {entry.metadata ? (
                      <pre className="mt-2 overflow-x-auto rounded-lg bg-background px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ul>

              <nav
                aria-label="Audit log pagination"
                className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4"
              >
                <p className="text-[12.5px] text-muted">
                  {total.toLocaleString("en-NG")} entries · page {page} of {pages}
                </p>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link
                      href={`/admin/audit-logs?${new URLSearchParams({ ...(action ? { action } : {}), page: String(page - 1) })}`}
                      className="inline-flex min-h-[36px] items-center rounded-lg border border-line px-3 text-[13px] font-semibold text-ink hover:border-ink/30"
                    >
                      Previous
                    </Link>
                  ) : null}
                  {page < pages ? (
                    <Link
                      href={`/admin/audit-logs?${new URLSearchParams({ ...(action ? { action } : {}), page: String(page + 1) })}`}
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
