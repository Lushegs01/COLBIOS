"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit/log";
import { requireAdminApi } from "@/lib/auth/guard";
import { assertCsrf } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/http/api";
import { describeError, logger } from "@/lib/logger";
import { isUniqueViolation } from "@/lib/payments/service";
import { clientIdentifier } from "@/lib/rate-limit/limiter";
import { cuidSchema, sessionCreateSchema } from "@/lib/validation/schemas";

import type { ActionState } from "../action-state";


export async function createSessionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await requireAdminApi("sessions:write");
    await guardCsrf(formData);

    const parsed = sessionCreateSchema.safeParse({
      name: String(formData.get("name") ?? ""),
      startsAt: String(formData.get("startsAt") ?? ""),
      endsAt: String(formData.get("endsAt") ?? ""),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the form and try again.", success: null };
    }

    try {
      const session = await prisma.academicSession.create({
        data: {
          name: parsed.data.name,
          active: false,
          startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
          endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        },
      });

      await recordAudit({
        action: "CREATE_SESSION",
        entityType: "AcademicSession",
        entityId: session.id,
        adminId: admin.id,
        adminEmail: admin.email,
        metadata: { name: session.name },
        ip: clientIdentifier(await headers()),
      });

      revalidatePath("/admin/sessions");
      return {
        error: null,
        success: `Session ${session.name} created. Set the dues for each level, then activate it.`,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { error: "That session already exists.", success: null };
      }
      throw error;
    }
  } catch (error) {
    return toState(error, "createSessionAction");
  }
}

/**
 * Activating a session opens payment for every student, so it is validated
 * first: a session with no active fees would send students to a dead end.
 *
 * Only one session may be active — the switch happens inside a transaction, and
 * the database holds a partial unique index that makes two active sessions
 * impossible even if this code were wrong.
 */
export async function activateSessionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await requireAdminApi("sessions:write");
    await guardCsrf(formData);

    const parsed = cuidSchema.safeParse(String(formData.get("id") ?? ""));
    if (!parsed.success) throw new AppError("NOT_FOUND", "That session no longer exists.");

    const session = await prisma.academicSession.findUnique({
      where: { id: parsed.data },
      include: { fees: { where: { active: true }, select: { id: true } } },
    });
    if (!session) throw new AppError("NOT_FOUND", "That session no longer exists.");

    if (session.fees.length === 0) {
      return {
        error: `${session.name} has no active dues configured. Add at least one level's dues before activating it.`,
        success: null,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.academicSession.updateMany({
        where: { active: true, id: { not: session.id } },
        data: { active: false },
      });
      await tx.academicSession.update({ where: { id: session.id }, data: { active: true } });
    });

    await recordAudit({
      action: "ACTIVATE_SESSION",
      entityType: "AcademicSession",
      entityId: session.id,
      adminId: admin.id,
      adminEmail: admin.email,
      metadata: { name: session.name, activeFeeCount: session.fees.length },
      ip: clientIdentifier(await headers()),
    });

    revalidatePath("/admin/sessions");
    revalidatePath("/admin");
    return { error: null, success: `${session.name} is now the active session. Students can pay.` };
  } catch (error) {
    return toState(error, "activateSessionAction");
  }
}

export async function deactivateSessionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await requireAdminApi("sessions:write");
    await guardCsrf(formData);

    const parsed = cuidSchema.safeParse(String(formData.get("id") ?? ""));
    if (!parsed.success) throw new AppError("NOT_FOUND", "That session no longer exists.");

    const session = await prisma.academicSession.update({
      where: { id: parsed.data },
      data: { active: false },
    });

    await recordAudit({
      action: "DEACTIVATE_SESSION",
      entityType: "AcademicSession",
      entityId: session.id,
      adminId: admin.id,
      adminEmail: admin.email,
      metadata: { name: session.name },
      ip: clientIdentifier(await headers()),
    });

    revalidatePath("/admin/sessions");
    revalidatePath("/admin");
    return {
      error: null,
      success: `${session.name} deactivated. Students can no longer start a payment until a session is activated.`,
    };
  } catch (error) {
    return toState(error, "deactivateSessionAction");
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
