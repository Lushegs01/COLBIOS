import type { NextRequest } from "next/server";

import { recordAudit } from "@/lib/audit/log";
import { requireAdminApi } from "@/lib/auth/guard";
import { assertCsrf } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { levelLabel, type LevelCode } from "@/lib/format/level";
import { AppError, ok, toErrorResponse } from "@/lib/http/api";
import { isUniqueViolation } from "@/lib/payments/service";
import { clientIdentifier } from "@/lib/rate-limit/limiter";
import { cuidSchema, feeCreateSchema, fieldErrors } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/fees — fee configuration, optionally for one session. */
export async function GET(request: NextRequest) {
  try {
    await requireAdminApi("fees:read");

    const sessionParam = request.nextUrl.searchParams.get("sessionId");
    const parsed = sessionParam ? cuidSchema.safeParse(sessionParam) : null;

    const fees = await prisma.fee.findMany({
      where: parsed?.success ? { sessionId: parsed.data } : {},
      orderBy: [{ sessionId: "asc" }, { level: "asc" }],
      include: { session: { select: { name: true, active: true } } },
    });

    return ok({
      fees: fees.map((fee) => ({
        id: fee.id,
        session: fee.session.name,
        sessionActive: fee.session.active,
        level: levelLabel(fee.level as LevelCode),
        code: fee.code,
        name: fee.name,
        amount: fee.amount,
        currency: fee.currency,
        active: fee.active,
      })),
    });
  } catch (error) {
    return toErrorResponse(error, "GET /api/admin/fees");
  }
}

/**
 * POST /api/admin/fees — create a fee.
 *
 * Requires `fees:write` and a CSRF token in the `x-csrf-token` header matching
 * the session cookie, so a signed-in administrator's browser cannot be induced
 * to change a fee by another site.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminApi("fees:write");
    if (!(await assertCsrf(request.headers.get("x-csrf-token")))) {
      throw new AppError("CSRF_FAILED");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("INVALID_REQUEST");
    }

    const parsed = feeCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Check the fee details.", {
        details: fieldErrors(parsed.error),
      });
    }

    const session = await prisma.academicSession.findUnique({
      where: { id: parsed.data.sessionId },
      select: { id: true, name: true },
    });
    if (!session) throw new AppError("NOT_FOUND", "That academic session does not exist.");

    try {
      const fee = await prisma.fee.create({
        data: {
          sessionId: session.id,
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
          via: "api",
        },
        ip: clientIdentifier(request.headers),
      });

      return ok({
        id: fee.id,
        level: levelLabel(fee.level as LevelCode),
        amount: fee.amount,
        currency: fee.currency,
        active: fee.active,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          "DUPLICATE_RESOURCE",
          "An active fee already exists for that session and level.",
        );
      }
      throw error;
    }
  } catch (error) {
    return toErrorResponse(error, "POST /api/admin/fees");
  }
}
