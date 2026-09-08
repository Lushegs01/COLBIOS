"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { diffMetadata, recordAudit } from "@/lib/audit/log";
import { requireAdminApi } from "@/lib/auth/guard";
import { assertCsrf } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/http/api";
import { describeError, logger } from "@/lib/logger";
import { isUniqueViolation } from "@/lib/payments/service";
import { clientIdentifier } from "@/lib/rate-limit/limiter";
import { departmentCreateSchema, departmentUpdateSchema } from "@/lib/validation/schemas";

import type { ActionState } from "../payments/actions";

export const IDLE: ActionState = { error: null, success: null };

/**
 * Department management.
 *
 * Departments are never deleted, only deactivated: every historical payment
 * keeps both a foreign key to the department and a snapshot of its name, so
 * renaming or retiring one cannot rewrite or break an old receipt.
 */

export async function createDepartmentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await requireAdminApi("departments:write");
    await guardCsrf(formData);

    const parsed = departmentCreateSchema.safeParse({
      name: String(formData.get("name") ?? ""),
      code: String(formData.get("code") ?? ""),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the form and try again.", success: null };
    }

    try {
      const department = await prisma.department.create({
        data: { name: parsed.data.name, code: parsed.data.code, active: true },
      });

      await recordAudit({
        action: "CREATE_DEPARTMENT",
        entityType: "Department",
        entityId: department.id,
        adminId: admin.id,
        adminEmail: admin.email,
        metadata: { name: department.name, code: department.code },
        ip: clientIdentifier(await headers()),
      });

      revalidatePath("/admin/departments");
      return { error: null, success: `${department.name} added.` };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { error: "A department with that name or code already exists.", success: null };
      }
      throw error;
    }
  } catch (error) {
    return toState(error, "createDepartmentAction");
  }
}

export async function updateDepartmentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await requireAdminApi("departments:write");
    await guardCsrf(formData);

    const parsed = departmentUpdateSchema.safeParse({
      id: String(formData.get("id") ?? ""),
      name: String(formData.get("name") ?? ""),
      code: String(formData.get("code") ?? ""),
      active: String(formData.get("active") ?? "") === "true",
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the form and try again.", success: null };
    }

    const before = await prisma.department.findUnique({ where: { id: parsed.data.id } });
    if (!before) throw new AppError("NOT_FOUND", "That department no longer exists.");

    try {
      const department = await prisma.department.update({
        where: { id: before.id },
        data: { name: parsed.data.name, code: parsed.data.code, active: parsed.data.active },
      });

      await recordAudit({
        action:
          before.active === department.active
            ? "UPDATE_DEPARTMENT"
            : department.active
              ? "ACTIVATE_DEPARTMENT"
              : "DEACTIVATE_DEPARTMENT",
        entityType: "Department",
        entityId: department.id,
        adminId: admin.id,
        adminEmail: admin.email,
        metadata: {
          changes: diffMetadata(
            { name: before.name, code: before.code, active: before.active },
            { name: department.name, code: department.code, active: department.active },
          ),
        },
        ip: clientIdentifier(await headers()),
      });

      revalidatePath("/admin/departments");
      return {
        error: null,
        success: department.active
          ? `${department.name} updated.`
          : `${department.name} deactivated — students can no longer select it. Existing payments are unaffected.`,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { error: "Another department already uses that name or code.", success: null };
      }
      throw error;
    }
  } catch (error) {
    return toState(error, "updateDepartmentAction");
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
