"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { diffMetadata, recordAudit } from "@/lib/audit/log";
import { requireAdminApi } from "@/lib/auth/guard";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { assertCsrf, clearSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/http/api";
import { describeError, logger } from "@/lib/logger";
import { isUniqueViolation } from "@/lib/payments/service";
import { clientIdentifier } from "@/lib/rate-limit/limiter";
import { adminPasswordSchema, cuidSchema, emailSchema } from "@/lib/validation/schemas";

import type { ActionState } from "../payments/actions";

export const IDLE: ActionState = { error: null, success: null };

const ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE"] as const;

/**
 * Administrator account management.
 *
 * Creating and deactivating accounts is restricted to SUPER_ADMIN; changing
 * your own password is not. Passwords are never logged, never echoed back, and
 * never included in an audit entry — the audit row records that a password
 * changed, not what it changed to.
 */

export async function createAdminAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await requireAdminApi("admins:manage");
    await guardCsrf(formData);

    const email = emailSchema.safeParse(String(formData.get("email") ?? ""));
    const name = String(formData.get("name") ?? "").trim();
    const role = String(formData.get("role") ?? "");
    const password = adminPasswordSchema.safeParse(String(formData.get("password") ?? ""));

    if (!email.success) return { error: "Enter a valid email address.", success: null };
    if (name.length < 3) return { error: "Enter the administrator's full name.", success: null };
    if (!(ROLES as readonly string[]).includes(role)) {
      return { error: "Choose a role.", success: null };
    }
    if (!password.success) {
      return { error: password.error.issues[0]?.message ?? "That password is too weak.", success: null };
    }

    try {
      const created = await prisma.adminUser.create({
        data: {
          email: email.data,
          name,
          role: role as (typeof ROLES)[number],
          passwordHash: await hashPassword(password.data),
          active: true,
        },
      });

      await recordAudit({
        action: "CREATE_ADMIN",
        entityType: "AdminUser",
        entityId: created.id,
        adminId: admin.id,
        adminEmail: admin.email,
        metadata: { createdEmail: created.email, role: created.role },
        ip: clientIdentifier(await headers()),
      });

      revalidatePath("/admin/settings");
      return {
        error: null,
        success: `Created ${created.role.replace("_", " ").toLowerCase()} account for ${created.email}. Share the password securely and ask them to change it.`,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { error: "An administrator with that email already exists.", success: null };
      }
      throw error;
    }
  } catch (error) {
    return toState(error, "createAdminAction");
  }
}

export async function toggleAdminAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await requireAdminApi("admins:manage");
    await guardCsrf(formData);

    const id = cuidSchema.safeParse(String(formData.get("id") ?? ""));
    if (!id.success) throw new AppError("NOT_FOUND", "That account no longer exists.");

    const active = String(formData.get("active") ?? "") === "true";

    if (id.data === admin.id && !active) {
      return { error: "You cannot deactivate your own account.", success: null };
    }

    const before = await prisma.adminUser.findUnique({ where: { id: id.data } });
    if (!before) throw new AppError("NOT_FOUND", "That account no longer exists.");

    // The last active super administrator must remain, or nobody can manage
    // accounts again without database access.
    if (!active && before.role === "SUPER_ADMIN") {
      const remaining = await prisma.adminUser.count({
        where: { role: "SUPER_ADMIN", active: true, id: { not: before.id } },
      });
      if (remaining === 0) {
        return {
          error: "This is the last active super administrator. Create another one first.",
          success: null,
        };
      }
    }

    const updated = await prisma.adminUser.update({
      where: { id: before.id },
      data: { active },
    });

    await recordAudit({
      action: active ? "UPDATE_ADMIN" : "DEACTIVATE_ADMIN",
      entityType: "AdminUser",
      entityId: updated.id,
      adminId: admin.id,
      adminEmail: admin.email,
      metadata: {
        targetEmail: updated.email,
        changes: diffMetadata({ active: before.active }, { active: updated.active }),
      },
      ip: clientIdentifier(await headers()),
    });

    revalidatePath("/admin/settings");
    return {
      error: null,
      success: active
        ? `${updated.email} can sign in again.`
        : `${updated.email} has been deactivated and can no longer sign in.`,
    };
  } catch (error) {
    return toState(error, "toggleAdminAction");
  }
}

/** Change your own password. Requires the current one, and ends the session. */
export async function changePasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await requireAdminApi();
    await guardCsrf(formData);

    const current = String(formData.get("currentPassword") ?? "");
    const next = adminPasswordSchema.safeParse(String(formData.get("newPassword") ?? ""));
    const confirm = String(formData.get("confirmPassword") ?? "");

    if (!next.success) {
      return { error: next.error.issues[0]?.message ?? "That password is too weak.", success: null };
    }
    if (next.data !== confirm) {
      return { error: "The new passwords do not match.", success: null };
    }

    const account = await prisma.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
    if (!(await verifyPassword(current, account.passwordHash))) {
      return { error: "Your current password is incorrect.", success: null };
    }
    if (await verifyPassword(next.data, account.passwordHash)) {
      return { error: "Choose a password you have not used here before.", success: null };
    }

    await prisma.adminUser.update({
      where: { id: account.id },
      data: { passwordHash: await hashPassword(next.data), passwordChangedAt: new Date() },
    });

    await recordAudit({
      action: "ADMIN_PASSWORD_CHANGED",
      entityType: "AdminUser",
      entityId: account.id,
      adminId: admin.id,
      adminEmail: admin.email,
      ip: clientIdentifier(await headers()),
    });

    // Force a fresh sign-in with the new password.
    await clearSessionCookie();

    return {
      error: null,
      success: "Password changed. Please sign in again with your new password.",
    };
  } catch (error) {
    return toState(error, "changePasswordAction");
  }
}

async function guardCsrf(formData: FormData): Promise<void> {
  if (!(await assertCsrf(String(formData.get("csrf") ?? "")))) throw new AppError("CSRF_FAILED");
}

function toState(error: unknown, scope: string): ActionState {
  if (error instanceof AppError) return { error: error.message, success: null };
  logger.error("unexpected_error", { scope, ...describeError(error) });
  return { error: "Something went wrong. Please try again.", success: null };
}
