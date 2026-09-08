import "server-only";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/http/api";
import type { AdminUser } from "@/lib/generated/prisma/client";

import { readSessionFromCookies, type AdminRoleValue } from "./session";

/**
 * Server-side authorization.
 *
 * Nothing in the admin area is protected by hiding a link. Every page, every
 * server action and every admin API route calls one of these guards, and each
 * one re-reads the account from the database — a role change or a deactivation
 * takes effect on the next request, not when the token expires.
 */

export type AdminContext = {
  id: string;
  email: string;
  name: string;
  role: AdminRoleValue;
};

/** Capability model. Roles are compared against these lists, never inline. */
export const PERMISSIONS = {
  "payments:read": ["SUPER_ADMIN", "ADMIN", "FINANCE"],
  "payments:export": ["SUPER_ADMIN", "ADMIN", "FINANCE"],
  "payments:adjust": ["SUPER_ADMIN", "FINANCE"],
  "fees:read": ["SUPER_ADMIN", "ADMIN", "FINANCE"],
  "fees:write": ["SUPER_ADMIN", "FINANCE"],
  "sessions:read": ["SUPER_ADMIN", "ADMIN", "FINANCE"],
  "sessions:write": ["SUPER_ADMIN", "ADMIN"],
  "departments:read": ["SUPER_ADMIN", "ADMIN", "FINANCE"],
  "departments:write": ["SUPER_ADMIN", "ADMIN"],
  "reports:read": ["SUPER_ADMIN", "ADMIN", "FINANCE"],
  "audit:read": ["SUPER_ADMIN", "ADMIN"],
  "admins:manage": ["SUPER_ADMIN"],
  "settings:read": ["SUPER_ADMIN", "ADMIN"],
} as const satisfies Record<string, readonly AdminRoleValue[]>;

export type Permission = keyof typeof PERMISSIONS;

export function roleHasPermission(role: AdminRoleValue, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly AdminRoleValue[]).includes(role);
}

/** The signed-in admin, or null. Never throws. */
export async function getAdminContext(): Promise<AdminContext | null> {
  const claims = await readSessionFromCookies();
  if (!claims) return null;

  const admin: AdminUser | null = await prisma.adminUser.findFirst({
    where: { id: claims.sub, active: true },
  });
  if (!admin) return null;

  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role as AdminRoleValue,
  };
}

/** For pages: bounce to the login screen, preserving where they were headed. */
export async function requireAdminPage(
  permission?: Permission,
  returnTo?: string,
): Promise<AdminContext> {
  const admin = await getAdminContext();
  if (!admin) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/admin/login${next}`);
  }
  if (permission && !roleHasPermission(admin.role, permission)) {
    redirect("/admin?denied=1");
  }
  return admin;
}

/** For API routes and server actions: throw a typed error the caller renders. */
export async function requireAdminApi(permission?: Permission): Promise<AdminContext> {
  const admin = await getAdminContext();
  if (!admin) throw new AppError("UNAUTHORIZED", "Please sign in to continue.");
  if (permission && !roleHasPermission(admin.role, permission)) {
    throw new AppError("FORBIDDEN", "You do not have permission to perform this action.");
  }
  return admin;
}
