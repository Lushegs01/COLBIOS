import "server-only";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/http/api";
import { compareLevels, type LevelCode } from "@/lib/format/level";
import type { AcademicSession, Department, Fee } from "@/lib/generated/prisma/client";

/**
 * Reads of the fee/session/department configuration.
 *
 * This is the *only* place the payable amount is determined. Nothing that comes
 * from a browser ever influences the result — the caller supplies a level, and
 * the database decides what that level costs.
 */

export type PublicDepartment = { id: string; name: string; code: string };
export type PublicLevelOption = { level: LevelCode; label: string; amount: number; currency: string };

/** The active academic session, or null when the college has not opened one. */
export async function getActiveSession(): Promise<AcademicSession | null> {
  return prisma.academicSession.findFirst({ where: { active: true } });
}

export async function requireActiveSession(): Promise<AcademicSession> {
  const session = await getActiveSession();
  if (!session) {
    throw new AppError(
      "NO_ACTIVE_SESSION",
      "Dues payment is not open at the moment. Please check back later or contact the college office.",
    );
  }
  return session;
}

/**
 * The active fee for a level in a session. Returns null rather than throwing so
 * callers can distinguish "no fee configured" from a hard failure.
 */
export async function findActiveFee(sessionId: string, level: LevelCode): Promise<Fee | null> {
  return prisma.fee.findFirst({
    where: { sessionId, level, active: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function requireActiveFee(sessionId: string, level: LevelCode): Promise<Fee> {
  const fee = await findActiveFee(sessionId, level);
  if (!fee) {
    throw new AppError(
      "NO_FEE_CONFIGURED",
      "Dues have not been set for your level in the current session yet. Please contact the college office.",
    );
  }
  return fee;
}

/** Departments a student may choose from. Inactive ones are never offered. */
export async function listActiveDepartments(): Promise<PublicDepartment[]> {
  const departments = await prisma.department.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
  return departments;
}

export async function requireActiveDepartment(departmentId: string): Promise<Department> {
  const department = await prisma.department.findFirst({
    where: { id: departmentId, active: true },
  });
  if (!department) {
    throw new AppError("INVALID_DEPARTMENT", "Please select a department from the list.");
  }
  return department;
}

/**
 * Levels a student may currently pay for: exactly those with an active fee in
 * the active session. The UI renders this list; it never hard-codes levels.
 */
export async function listPayableLevels(sessionId: string): Promise<PublicLevelOption[]> {
  const fees = await prisma.fee.findMany({
    where: { sessionId, active: true },
    select: { level: true, amount: true, currency: true },
  });

  return fees
    .map((fee) => ({
      level: fee.level as LevelCode,
      label: `${fee.level.slice(1)}L`,
      amount: fee.amount,
      currency: fee.currency,
    }))
    .sort((a, b) => compareLevels(a.level, b.level));
}

export type PaymentConfiguration = {
  session: { id: string; name: string } | null;
  departments: PublicDepartment[];
  levels: PublicLevelOption[];
};

/**
 * Everything the payment form needs, in one round trip. Safe to expose
 * publicly: it contains no identifiers beyond the department ids the form must
 * submit back, and no internal configuration.
 */
export async function getPaymentConfiguration(): Promise<PaymentConfiguration> {
  const session = await getActiveSession();
  if (!session) return { session: null, departments: await listActiveDepartments(), levels: [] };

  const [departments, levels] = await Promise.all([
    listActiveDepartments(),
    listPayableLevels(session.id),
  ]);

  return { session: { id: session.id, name: session.name }, departments, levels };
}
