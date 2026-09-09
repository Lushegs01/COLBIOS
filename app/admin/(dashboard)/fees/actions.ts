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
import { feeCreateSchema, feeToggleSchema, feeUpdateSchema } from "@/lib/validation/schemas";

import type { ActionState } from "../action-state";


/**
 * Fee configuration.
 *
 * This is where the amount every student is charged is decided, so each action
 * requires the `fees:write` permission, a valid CSRF token, and leaves an audit
 * row recording the old and new amounts. There is no path that changes a fee
 * without all three.
 */

export async function createFeeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await requireAdminApi("fees:write");
    await guardCsrf(formData);

    const parsed = feeCreateSchema.safeParse({
      sessionId: String(formData.get("sessionId") ?? ""),
      level: String(formData.get("level") ?? ""),
      name: String(formData.get("name") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      currency: String(formData.get("currency") || "NGN"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the form and try again.", success: null };
    }

    const session = await prisma.academicSession.findUnique({ where: { id: parsed.data.sessionId } });
    if (!session) throw new AppError("NOT_FOUND", "That academic session no longer exists.");

    try {
      const fee = await prisma.fee.create({
        data: {
          sessionId: parsed.data.sessionId,
          level: parsed.data.level,
          code: "COLBIOS_DUES",
          name: parsed.data.name,
          amount: parsed.data.amount,
          currency: parsed.data.currency,
          active: true,
        },
      });

      await recordAudit({
        action: "CREATE_FEE",
        entityType: "Fee",
        entityId: fee.id,
        adminId: admin.id,
        adminEmail: admin.email,
        metadata: {
          sessionName: session.name,
          level: fee.level,
          amountMinor: fee.amount,
          currency: fee.currency,
        },
        ip: clientIdentifier(await headers()),
      });

      revalidatePath("/admin/fees");
      return { error: null, success: `Dues for ${levelText(fee.level)} created.` };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return {
          error: `An active dues amount already exists for ${levelText(parsed.data.level)} in ${session.name}. Edit or deactivate it first.`,
          success: null,
        };
      }
      throw error;
    }
  } catch (error) {
    return toState(error, "createFeeAction");
  }
}

export async function updateFeeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await requireAdminApi("fees:write");
    await guardCsrf(formData);

    const parsed = feeUpdateSchema.safeParse({
      id: String(formData.get("id") ?? ""),
      name: String(formData.get("name") ?? ""),
      amount: String(formData.get("amount") ?? ""),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the form and try again.", success: null };
    }

    const before = await prisma.fee.findUnique({
      where: { id: parsed.data.id },
      include: { session: { select: { name: true } } },
    });
    if (!before) throw new AppError("NOT_FOUND", "That fee no longer exists.");

    const fee = await prisma.fee.update({
      where: { id: before.id },
      data: { name: parsed.data.name, amount: parsed.data.amount },
    });

    await recordAudit({
      action: "UPDATE_FEE",
      entityType: "Fee",
      entityId: fee.id,
      adminId: admin.id,
      adminEmail: admin.email,
      metadata: {
        sessionName: before.session.name,
        level: fee.level,
        changes: diffMetadata(
          { name: before.name, amountMinor: before.amount },
          { name: fee.name, amountMinor: fee.amount },
        ),
      },
      ip: clientIdentifier(await headers()),
    });

    revalidatePath("/admin/fees");
    return {
      error: null,
      success: `Dues for ${levelText(fee.level)} updated. Payments already made keep the amount they were charged.`,
    };
  } catch (error) {
    return toState(error, "updateFeeAction");
  }
}

export async function toggleFeeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await requireAdminApi("fees:write");
    await guardCsrf(formData);

    const parsed = feeToggleSchema.safeParse({
      id: String(formData.get("id") ?? ""),
      active: String(formData.get("active") ?? "") === "true",
    });
    if (!parsed.success) throw new AppError("INVALID_REQUEST");

    const before = await prisma.fee.findUnique({
      where: { id: parsed.data.id },
      include: { session: { select: { name: true } } },
    });
    if (!before) throw new AppError("NOT_FOUND", "That fee no longer exists.");

    try {
      const fee = await prisma.fee.update({
        where: { id: before.id },
        data: { active: parsed.data.active },
      });

      await recordAudit({
        action: parsed.data.active ? "ACTIVATE_FEE" : "DEACTIVATE_FEE",
        entityType: "Fee",
        entityId: fee.id,
        adminId: admin.id,
        adminEmail: admin.email,
        metadata: {
          sessionName: before.session.name,
          level: fee.level,
          amountMinor: fee.amount,
          changes: diffMetadata({ active: before.active }, { active: fee.active }),
        },
        ip: clientIdentifier(await headers()),
      });

      revalidatePath("/admin/fees");
      return {
        error: null,
        success: parsed.data.active
          ? `${levelText(fee.level)} dues are now active — students at this level can pay.`
          : `${levelText(fee.level)} dues deactivated — students at this level can no longer start a payment.`,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return {
          error: `Another active dues amount already exists for ${levelText(before.level)} in ${before.session.name}.`,
          success: null,
        };
      }
      throw error;
    }
  } catch (error) {
    return toState(error, "toggleFeeAction");
  }
}

async function guardCsrf(formData: FormData): Promise<void> {
  if (!(await assertCsrf(String(formData.get("csrf") ?? "")))) throw new AppError("CSRF_FAILED");
}

function levelText(level: string): string {
  return `${level.slice(1)}L`;
}

function toState(error: unknown, scope: string): ActionState {
  if (error instanceof AppError) return { error: error.message, success: null };
  logger.error("unexpected_error", { scope, ...describeError(error) });
  return { error: "Something went wrong. Please try again.", success: null };
}
