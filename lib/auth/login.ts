import "server-only";

import { recordAudit } from "@/lib/audit/log";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { RATE_LIMITS, checkRateLimit } from "@/lib/rate-limit/limiter";

import { dummyCompare, verifyPassword } from "./password";
import { setSessionCookie, type AdminRoleValue } from "./session";

/**
 * Administrator sign-in.
 *
 * Three defences, all of them mattering:
 *  - two rate limits, one per IP and one per account, so neither spraying one
 *    password across many accounts nor guessing one account gets far;
 *  - a constant-ish response whether or not the email exists (a bcrypt compare
 *    still runs against a dummy hash), so the endpoint cannot be used to
 *    enumerate administrators;
 *  - one generic message for every failure, and an audit row for each attempt.
 */

export type LoginRequest = {
  email: string;
  password: string;
  ip: string;
  userAgent: string | null;
};

export type LoginOutcome =
  | { ok: true; role: AdminRoleValue }
  | { ok: false; reason: "invalid" | "rate_limited" };

export async function authenticateAdmin(request: LoginRequest): Promise<LoginOutcome> {
  const [byIp, byAccount] = await Promise.all([
    checkRateLimit(RATE_LIMITS.adminLogin, request.ip),
    checkRateLimit(RATE_LIMITS.adminLoginAccount, request.email),
  ]);

  if (!byIp.allowed || !byAccount.allowed) {
    logger.warn("admin_login_failed", { reason: "rate_limited" });
    return { ok: false, reason: "rate_limited" };
  }

  const admin = await prisma.adminUser.findUnique({ where: { email: request.email } });

  if (!admin || !admin.active) {
    await dummyCompare(request.password);
    await recordAudit({
      action: "ADMIN_LOGIN_FAILED",
      entityType: "AdminUser",
      adminEmail: request.email,
      metadata: { reason: admin ? "inactive_account" : "unknown_account" },
      ip: request.ip,
      userAgent: request.userAgent,
    });
    logger.warn("admin_login_failed", { reason: "unknown_or_inactive" });
    return { ok: false, reason: "invalid" };
  }

  const passwordValid = await verifyPassword(request.password, admin.passwordHash);
  if (!passwordValid) {
    await recordAudit({
      action: "ADMIN_LOGIN_FAILED",
      entityType: "AdminUser",
      entityId: admin.id,
      adminEmail: admin.email,
      metadata: { reason: "bad_password" },
      ip: request.ip,
      userAgent: request.userAgent,
    });
    logger.warn("admin_login_failed", { reason: "bad_password" });
    return { ok: false, reason: "invalid" };
  }

  await setSessionCookie({
    sub: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role as AdminRoleValue,
  });

  await prisma.adminUser
    .update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } })
    .catch(() => undefined);

  await recordAudit({
    action: "ADMIN_LOGIN",
    entityType: "AdminUser",
    entityId: admin.id,
    adminEmail: admin.email,
    metadata: { role: admin.role },
    ip: request.ip,
    userAgent: request.userAgent,
  });

  logger.info("admin_login", { adminEmail: admin.email, role: admin.role });
  return { ok: true, role: admin.role as AdminRoleValue };
}
