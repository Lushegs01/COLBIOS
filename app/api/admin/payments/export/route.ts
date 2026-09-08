import { NextResponse, type NextRequest } from "next/server";

import { csvRow, exportFilename } from "@/lib/admin/csv";
import { iteratePaymentsForExport } from "@/lib/admin/payments-query";
import { recordAudit } from "@/lib/audit/log";
import { requireAdminApi } from "@/lib/auth/guard";
import { levelLabel, type LevelCode } from "@/lib/format/level";
import { minorToMajorString } from "@/lib/format/money";
import { toErrorResponse } from "@/lib/http/api";
import { clientIdentifier } from "@/lib/rate-limit/limiter";
import { paymentFilterSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = [
  "Reference",
  "Receipt Number",
  "Full Name",
  "Matric Number",
  "Email",
  "Department",
  "Level",
  "Academic Session",
  "Fee",
  "Amount",
  "Currency",
  "Status",
  "Payment Channel",
  "Recorded Manually",
  "Paid At",
  "Created At",
];

/**
 * GET /api/admin/payments/export
 *
 * Streams the filtered payments as CSV. Streaming rather than buffering means a
 * whole-session export does not have to fit in the function's memory, and the
 * download starts immediately on a slow connection.
 *
 * The export is itself an auditable act — it leaves the college with a file of
 * student data — so it writes an audit row before the first byte goes out.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminApi("payments:export");

    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = paymentFilterSchema.safeParse(params);
    const filter = parsed.success ? parsed.data : paymentFilterSchema.parse({});

    await recordAudit({
      action: "EXPORT_REPORT",
      entityType: "Payment",
      adminId: admin.id,
      adminEmail: admin.email,
      metadata: { export: "payments_csv", filters: params },
      ip: clientIdentifier(request.headers),
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(csvRow(HEADERS)));

          for await (const batch of iteratePaymentsForExport(filter)) {
            let chunk = "";
            for (const payment of batch) {
              chunk += csvRow([
                payment.reference,
                payment.receiptNumber ?? "",
                payment.fullName,
                payment.matricNumber,
                payment.email,
                payment.departmentName,
                levelLabel(payment.level as LevelCode),
                payment.sessionName,
                payment.feeName,
                minorToMajorString(payment.amount),
                payment.currency,
                payment.status,
                payment.channel ?? "",
                payment.isManualAdjustment ? "YES" : "NO",
                payment.paidAt ? payment.paidAt.toISOString() : "",
                payment.createdAt.toISOString(),
              ]);
            }
            controller.enqueue(encoder.encode(chunk));
          }

          controller.close();
        } catch {
          // The response has already begun, so the only honest signal left is a
          // truncated file with a trailing marker.
          controller.enqueue(encoder.encode(csvRow(["EXPORT INCOMPLETE — please retry"])));
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename("colbios-payments")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return toErrorResponse(error, "GET /api/admin/payments/export");
  }
}
