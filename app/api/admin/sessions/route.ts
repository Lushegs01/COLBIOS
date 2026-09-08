import type { NextRequest } from "next/server";

import { recordAudit } from "@/lib/audit/log";
import { requireAdminApi } from "@/lib/auth/guard";
import { assertCsrf } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AppError, ok, toErrorResponse } from "@/lib/http/api";
import { isUniqueViolation } from "@/lib/payments/service";
import { clientIdentifier } from "@/lib/rate-limit/limiter";
import { fieldErrors, sessionCreateSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/sessions — every academic session with its fee counts. */
export async function GET() {
  try {
    await requireAdminApi("sessions:read");

    const sessions = await prisma.academicSession.findMany({
      orderBy: [{ active: "desc" }, { name: "desc" }],
      include: { _count: { select: { fees: true, payments: true } } },
    });

    return ok({
      sessions: sessions.map((session) => ({
        id: session.id,
        name: session.name,
        active: session.active,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        feeCount: session._count.fees,
        paymentCount: session._count.payments,
      })),
    });
  } catch (error) {
    return toErrorResponse(error, "GET /api/admin/sessions");
  }
}

/**
 * POST /api/admin/sessions — create a session (inactive).
 *
 * Activation is deliberately not exposed here: it opens payment for every
 * student and requires the fee-configuration check, so it lives behind the
 * dashboard action that performs that validation.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminApi("sessions:write");
    if (!(await assertCsrf(request.headers.get("x-csrf-token")))) {
      throw new AppError("CSRF_FAILED");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("INVALID_REQUEST");
    }

    const parsed = sessionCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Check the session details.", {
        details: fieldErrors(parsed.error),
      });
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
        metadata: { name: session.name, via: "api" },
        ip: clientIdentifier(request.headers),
      });

      return ok({ id: session.id, name: session.name, active: session.active });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError("DUPLICATE_RESOURCE", "That session already exists.");
      }
      throw error;
    }
  } catch (error) {
    return toErrorResponse(error, "POST /api/admin/sessions");
  }
}
