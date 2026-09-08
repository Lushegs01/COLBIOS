import "server-only";

import { prisma } from "@/lib/db/prisma";
import { describeError, logger, redact } from "@/lib/logger";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Administrative audit trail.
 *
 * Every financially significant action writes a row here: who did it, what
 * changed, and when. Metadata passes through the same redactor as the logs, so
 * a password or key can never end up in the trail even if a caller is careless.
 */

export const AUDIT_ACTIONS = [
  "ADMIN_LOGIN",
  "ADMIN_LOGIN_FAILED",
  "ADMIN_LOGOUT",
  "ADMIN_PASSWORD_CHANGED",
  "CREATE_ADMIN",
  "UPDATE_ADMIN",
  "DEACTIVATE_ADMIN",
  "CREATE_SESSION",
  "ACTIVATE_SESSION",
  "DEACTIVATE_SESSION",
  "UPDATE_SESSION",
  "CREATE_FEE",
  "UPDATE_FEE",
  "ACTIVATE_FEE",
  "DEACTIVATE_FEE",
  "CREATE_DEPARTMENT",
  "UPDATE_DEPARTMENT",
  "ACTIVATE_DEPARTMENT",
  "DEACTIVATE_DEPARTMENT",
  "MANUAL_PAYMENT_ADJUSTMENT",
  "REFUND_ACTION",
  "EXPORT_REPORT",
  "VIEW_SENSITIVE_REPORT",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntry = {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  adminId?: string | null;
  adminEmail?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
};

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        adminId: entry.adminId ?? null,
        adminEmail: entry.adminEmail ?? null,
        metadata: entry.metadata
          ? (redact(entry.metadata) as Prisma.InputJsonValue)
          : undefined,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent?.slice(0, 300) ?? null,
      },
    });

    logger.info("admin_action", {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      adminEmail: entry.adminEmail,
    });
  } catch (error) {
    // An audit write must never break the action it describes, but a failure to
    // record one is itself worth an alert.
    logger.error("unexpected_error", { scope: "audit", action: entry.action, ...describeError(error) });
  }
}

/**
 * Helper for "field changed from X to Y" entries, which is what makes a fee
 * change reviewable months later.
 */
export function diffMetadata<T extends Record<string, unknown>>(
  before: T,
  after: T,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[key] !== after[key]) changes[key] = { from: before[key], to: after[key] };
  }
  return changes;
}
