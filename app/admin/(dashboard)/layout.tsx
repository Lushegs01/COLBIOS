import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "COLBIOS Dues Administration",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Every authenticated admin route sits inside this layout, so an unauthenticated
 * request is redirected before any page component runs. Individual pages still
 * assert their own permission — a layout check alone would not stop a FINANCE
 * user opening a SUPER_ADMIN page.
 */
export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdminPage();
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
