import { AdminCard, AdminPageHeader, EmptyState } from "@/components/admin/AdminShell";
import FeeManager from "@/components/admin/FeeManager";
import { requireAdminPage, roleHasPermission } from "@/lib/auth/guard";
import { currentCsrfToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * Fee management, grouped by academic session.
 *
 * These rows are the single source of truth for what a student is charged.
 * Nothing in the student-facing code carries a fallback amount, so a level with
 * no active fee here simply cannot be paid for — which is the safe failure.
 */
export default async function AdminFeesPage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const admin = await requireAdminPage("fees:read", "/admin/fees");
  const { sessionId } = await searchParams;

  const sessions = await prisma.academicSession.findMany({
    orderBy: [{ active: "desc" }, { name: "desc" }],
    include: { fees: { orderBy: [{ level: "asc" }, { createdAt: "desc" }] } },
  });

  const selected = sessions.find((session) => session.id === sessionId) ?? sessions[0] ?? null;
  const canWrite = roleHasPermission(admin.role, "fees:write");
  const csrf = await currentCsrfToken();

  return (
    <>
      <AdminPageHeader
        title="Dues by level"
        description="Set what each level pays. Amounts apply to new payments only — receipts already issued keep the amount that was charged."
      />

      {sessions.length === 0 ? (
        <AdminCard>
          <EmptyState
            title="No academic session yet"
            description="Create a session first, then set the dues for each level."
          />
        </AdminCard>
      ) : (
        <FeeManager
          sessions={sessions.map((session) => ({
            id: session.id,
            name: session.name,
            active: session.active,
            fees: session.fees.map((fee) => ({
              id: fee.id,
              level: fee.level,
              name: fee.name,
              amount: fee.amount,
              currency: fee.currency,
              active: fee.active,
            })),
          }))}
          selectedSessionId={selected?.id ?? ""}
          canWrite={canWrite}
          csrf={csrf}
        />
      )}
    </>
  );
}
