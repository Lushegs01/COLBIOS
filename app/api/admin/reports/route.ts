import type { NextRequest } from "next/server";

import {
  getChannelBreakdown,
  getDailySeries,
  getDashboardStats,
  getDepartmentBreakdown,
  getLevelBreakdown,
} from "@/lib/admin/analytics";
import { requireAdminApi } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse } from "@/lib/http/api";
import { cuidSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reports
 *
 * Aggregates only — this route never returns individual payment rows. Use
 * /api/admin/payments for those, where the same permission check applies.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminApi("reports:read");

    const sessionParam = request.nextUrl.searchParams.get("sessionId");
    const parsedSession = sessionParam ? cuidSchema.safeParse(sessionParam) : null;

    const session = parsedSession?.success
      ? await prisma.academicSession.findUnique({
          where: { id: parsedSession.data },
          select: { id: true, name: true },
        })
      : await prisma.academicSession.findFirst({
          where: { active: true },
          select: { id: true, name: true },
        });

    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    const range = {
      from: from ? new Date(`${from}T00:00:00.000Z`) : undefined,
      to: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
    };

    const [stats, levels, departments, channels, series] = await Promise.all([
      getDashboardStats(session?.id ?? null, range),
      getLevelBreakdown(session?.id ?? null),
      getDepartmentBreakdown(session?.id ?? null),
      getChannelBreakdown(session?.id ?? null),
      getDailySeries(session?.id ?? null, 30),
    ]);

    return ok({
      session: session ? { name: session.name } : null,
      totals: {
        collected: stats.totalCollectedMinor,
        expected: stats.totalExpectedMinor,
        currency: stats.currency,
        paidStudents: stats.paidStudents,
        outstandingStudents: stats.outstandingStudents,
        transactions: stats.total,
        byStatus: stats.byStatus,
      },
      byLevel: levels,
      byDepartment: departments,
      byChannel: channels,
      byDate: series,
    });
  } catch (error) {
    return toErrorResponse(error, "GET /api/admin/reports");
  }
}
