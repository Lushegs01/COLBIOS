import { AdminCard, AdminPageHeader } from "@/components/admin/AdminShell";
import AdminAccountManager from "@/components/admin/AdminAccountManager";
import { requireAdminPage, roleHasPermission } from "@/lib/auth/guard";
import { currentCsrfToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { absoluteUrl, serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

/**
 * Settings: administrator accounts and a configuration health check.
 *
 * The health panel reports whether each integration is configured — never the
 * values themselves. It shows "test mode" or "live mode", not the key.
 */
export default async function AdminSettingsPage() {
  const admin = await requireAdminPage("settings:read", "/admin/settings");
  const canManageAdmins = roleHasPermission(admin.role, "admins:manage");

  const [admins, activeSession, activeFees] = await Promise.all([
    canManageAdmins
      ? prisma.adminUser.findMany({
          orderBy: [{ active: "desc" }, { createdAt: "asc" }],
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            active: true,
            lastLoginAt: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    prisma.academicSession.findFirst({ where: { active: true }, select: { id: true, name: true } }),
    prisma.fee.count({ where: { active: true } }),
  ]);

  const paystackConfigured = Boolean(process.env.PAYSTACK_SECRET_KEY);
  const checks = [
    {
      label: "Payment provider",
      ok: paystackConfigured,
      detail: paystackConfigured
        ? serverEnv.isPaystackTestMode
          ? "Paystack configured in TEST mode — no real money moves."
          : "Paystack configured in LIVE mode."
        : "PAYSTACK_SECRET_KEY is not set. Students cannot pay.",
      warn: paystackConfigured && serverEnv.isPaystackTestMode,
    },
    {
      label: "Webhook endpoint",
      ok: true,
      detail: `Set this URL in the Paystack dashboard: ${absoluteUrl("/api/payments/webhook")}`,
    },
    {
      label: "Active academic session",
      ok: Boolean(activeSession),
      detail: activeSession
        ? `${activeSession.name} is open for payment.`
        : "No session is active — students see a “payment not open” message.",
    },
    {
      label: "Configured dues",
      ok: activeFees > 0,
      detail:
        activeFees > 0
          ? `${activeFees} active fee ${activeFees === 1 ? "definition" : "definitions"}.`
          : "No active dues configured. Students cannot pay.",
    },
    {
      label: "Receipt email",
      ok: serverEnv.emailEnabled,
      detail: serverEnv.emailEnabled
        ? "Resend is configured. Confirmation emails and PDF receipts are sent."
        : "RESEND_API_KEY or FROM_EMAIL is not set. Payments still work; confirmation emails are skipped.",
      warn: !serverEnv.emailEnabled,
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Settings"
        description="Administrator accounts and deployment health."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard title="Configuration" description="What is set up in this deployment">
          <ul className="space-y-3">
            {checks.map((check) => (
              <li key={check.label} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    !check.ok ? "bg-red-500" : check.warn ? "bg-amber-500" : "bg-pine-600"
                  }`}
                />
                <div>
                  <p className="text-[13.5px] font-semibold text-ink">
                    {check.label}
                    <span className="sr-only">
                      : {!check.ok ? "not configured" : check.warn ? "warning" : "ready"}
                    </span>
                  </p>
                  <p className="mt-0.5 break-words text-[12.5px] leading-relaxed text-muted">
                    {check.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </AdminCard>

        <AdminCard title="Your account">
          <dl className="space-y-3">
            <div>
              <dt className="text-[11.5px] text-muted">Name</dt>
              <dd className="text-[13.5px] font-semibold text-ink">{admin.name}</dd>
            </div>
            <div>
              <dt className="text-[11.5px] text-muted">Email</dt>
              <dd className="text-[13.5px] font-semibold text-ink">{admin.email}</dd>
            </div>
            <div>
              <dt className="text-[11.5px] text-muted">Role</dt>
              <dd className="text-[13.5px] font-semibold text-ink">
                {admin.role.replace("_", " ").toLowerCase()}
              </dd>
            </div>
          </dl>
        </AdminCard>
      </div>

      <div className="mt-4">
        <AdminAccountManager
          csrf={await currentCsrfToken()}
          canManageAdmins={canManageAdmins}
          currentAdminId={admin.id}
          admins={admins.map((account) => ({
            id: account.id,
            email: account.email,
            name: account.name,
            role: account.role,
            active: account.active,
            lastLogin: account.lastLoginAt ? dateFormatter.format(account.lastLoginAt) : "Never",
          }))}
        />
      </div>
    </>
  );
}
