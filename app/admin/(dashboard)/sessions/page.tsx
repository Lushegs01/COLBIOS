import { AdminPageHeader } from "@/components/admin/AdminShell";
import SessionManager from "@/components/admin/SessionManager";
import { requireAdminPage, roleHasPermission } from "@/lib/auth/guard";
import { currentCsrfToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "UTC" });

export default async function AdminSessionsPage() {
  const admin = await requireAdminPage("sessions:read", "/admin/sessions");

  const sessions = await prisma.academicSession.findMany({
    orderBy: [{ active: "desc" }, { name: "desc" }],
    include: {
      _count: { select: { fees: true, payments: true } },
      fees: { where: { active: true }, select: { id: true } },
    },
  });

  // One grouped query for collected totals rather than a query per session.
  const collected = await prisma.payment.groupBy({
    by: ["sessionId"],
    where: { status: "SUCCESS" },
    _sum: { amount: true },
  });
  const collectedBySession = new Map(collected.map((row) => [row.sessionId, row._sum.amount ?? 0]));

  return (
    <>
      <AdminPageHeader
        title="Academic sessions"
        description="Dues are always paid against a session. A session must have at least one configured level before it can be activated."
      />

      <SessionManager
        canWrite={roleHasPermission(admin.role, "sessions:write")}
        csrf={await currentCsrfToken()}
        sessions={sessions.map((session) => ({
          id: session.id,
          name: session.name,
          active: session.active,
          startsAt: session.startsAt ? dateFormatter.format(session.startsAt) : null,
          endsAt: session.endsAt ? dateFormatter.format(session.endsAt) : null,
          activeFeeCount: session.fees.length,
          paymentCount: session._count.payments,
          collectedMinor: collectedBySession.get(session.id) ?? 0,
        }))}
      />
    </>
  );
}
