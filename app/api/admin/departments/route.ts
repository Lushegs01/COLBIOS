import type { NextRequest } from "next/server";

import { recordAudit } from "@/lib/audit/log";
import { requireAdminApi } from "@/lib/auth/guard";
import { assertCsrf } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AppError, ok, toErrorResponse } from "@/lib/http/api";
import { isUniqueViolation } from "@/lib/payments/service";
import { clientIdentifier } from "@/lib/rate-limit/limiter";
import { departmentCreateSchema, fieldErrors } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/departments */
export async function GET() {
  try {
    await requireAdminApi("departments:read");

    const departments = await prisma.department.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { payments: true } } },
    });

    return ok({
      departments: departments.map((department) => ({
        id: department.id,
        name: department.name,
        code: department.code,
        active: department.active,
        paymentCount: department._count.payments,
      })),
    });
  } catch (error) {
    return toErrorResponse(error, "GET /api/admin/departments");
  }
}

/** POST /api/admin/departments — add a department students can choose. */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminApi("departments:write");
    if (!(await assertCsrf(request.headers.get("x-csrf-token")))) {
      throw new AppError("CSRF_FAILED");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("INVALID_REQUEST");
    }

    const parsed = departmentCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Check the department details.", {
        details: fieldErrors(parsed.error),
      });
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
        metadata: { name: department.name, code: department.code, via: "api" },
        ip: clientIdentifier(request.headers),
      });

      return ok({
        id: department.id,
        name: department.name,
        code: department.code,
        active: department.active,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          "DUPLICATE_RESOURCE",
          "A department with that name or code already exists.",
        );
      }
      throw error;
    }
  } catch (error) {
    return toErrorResponse(error, "POST /api/admin/departments");
  }
}
