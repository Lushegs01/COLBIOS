import type { NextRequest } from "next/server";

import { findPayments } from "@/lib/admin/payments-query";
import { requireAdminApi } from "@/lib/auth/guard";
import { levelLabel, type LevelCode } from "@/lib/format/level";
import { ok, toErrorResponse } from "@/lib/http/api";
import { paymentFilterSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/payments
 *
 * The same search the admin table uses, as JSON. Authorization is checked here
 * independently — being signed in to the dashboard is irrelevant to this route.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminApi("payments:read");

    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = paymentFilterSchema.safeParse(params);
    const filter = parsed.success ? parsed.data : paymentFilterSchema.parse({});

    const { rows, total, page, pages } = await findPayments(filter);

    return ok({
      payments: rows.map((row) => ({
        id: row.id,
        reference: row.reference,
        fullName: row.fullName,
        matricNumber: row.matricNumber,
        department: row.departmentName,
        level: levelLabel(row.level as LevelCode),
        session: row.sessionName,
        fee: row.feeName,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        channel: row.channel,
        receiptNumber: row.receiptNumber,
        isManualAdjustment: row.isManualAdjustment,
        paidAt: row.paidAt,
        createdAt: row.createdAt,
      })),
      pagination: { total, page, pages },
    });
  } catch (error) {
    return toErrorResponse(error, "GET /api/admin/payments");
  }
}
