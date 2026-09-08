import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/app/admin/login/actions";
import { roleHasPermission, type AdminContext, type Permission } from "@/lib/auth/guard";

/**
 * The admin chrome.
 *
 * Navigation is filtered by permission purely so the interface is honest about
 * what a role can do. It is *not* the access control — every page and action
 * behind these links runs its own server-side check, so a hand-typed URL gets
 * exactly as far as the role allows.
 */

type NavItem = { href: string; label: string; permission: Permission };

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", permission: "payments:read" },
  { href: "/admin/payments", label: "Payments", permission: "payments:read" },
  { href: "/admin/students", label: "Students", permission: "payments:read" },
  { href: "/admin/fees", label: "Fees", permission: "fees:read" },
  { href: "/admin/sessions", label: "Sessions", permission: "sessions:read" },
  { href: "/admin/departments", label: "Departments", permission: "departments:read" },
  { href: "/admin/reports", label: "Reports", permission: "reports:read" },
  { href: "/admin/audit-logs", label: "Audit log", permission: "audit:read" },
  { href: "/admin/settings", label: "Settings", permission: "settings:read" },
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super administrator",
  ADMIN: "Administrator",
  FINANCE: "Finance",
};

export function AdminShell({ admin, children }: { admin: AdminContext; children: ReactNode }) {
  const items = NAV.filter((item) => roleHasPermission(admin.role, item.permission));

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-lift"
      >
        Skip to content
      </a>

      <header className="border-b border-line bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 place-items-center rounded-lg bg-pine-700 text-[13px] font-bold text-white"
            >
              CB
            </span>
            <span className="leading-tight">
              <span className="block text-[14.5px] font-semibold tracking-tight text-ink">
                COLBIOS Dues
              </span>
              <span className="block text-[11px] text-muted">Administration</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-[13px] font-semibold text-ink">{admin.name}</p>
              <p className="text-[11px] text-muted">{ROLE_LABELS[admin.role] ?? admin.role}</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="min-h-[38px] rounded-lg border border-line px-3 text-[13px] font-semibold text-ink transition-colors hover:border-ink/30"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav aria-label="Admin sections" className="border-t border-line">
          <div className="mx-auto w-full max-w-7xl overflow-x-auto px-4 sm:px-6">
            <ul className="flex min-w-max items-center gap-1 py-1.5">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-block rounded-lg px-3 py-2 text-[13.5px] font-medium text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </header>

      <main id="admin-main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-ink">{title}</h1>
        {description ? (
          <p className="mt-1 text-[14px] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminCard({
  title,
  description,
  children,
  actions,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white shadow-soft">
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-[12.5px] text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-5 py-10 text-center">
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
    </div>
  );
}
