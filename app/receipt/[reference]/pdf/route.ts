import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { AppError, toErrorResponse } from "@/lib/http/api";
import { buildReceiptPdf } from "@/lib/receipts/pdf";
import {
  RATE_LIMITS,
  checkRateLimit,
  clientIdentifier,
} from "@/lib/rate-limit/limiter";
import { referenceSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /receipt/[reference]/pdf
 *
 * Renders the receipt PDF on demand. Nothing is stored: the document is built
 * from the payment record each time, so it can never drift out of step with the
 * payment it describes.
 *
 * A PDF is only produced for a SUCCESS payment — there is no code path that
 * generates a receipt document for an unverified one.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<"/receipt/[reference]/pdf">,
) {
  try {
    const limit = await checkRateLimit(RATE_LIMITS.publicLookup, clientIdentifier(request.headers));
    if (!limit.allowed) {
      throw new AppError("RATE_LIMITED", "Too many requests. Please try again shortly.");
    }

    const { reference: raw } = await context.params;
    const parsed = referenceSchema.safeParse(decodeURIComponent(raw));
    if (!parsed.success) throw new AppError("INVALID_REFERENCE");

    const payment = await prisma.payment.findUnique({
      where: { reference: parsed.data },
      include: { receipt: true },
    });

    if (!payment) throw new AppError("PAYMENT_NOT_FOUND");
    if (payment.status !== "SUCCESS" || !payment.receipt) {
      throw new AppError(
        "RECEIPT_NOT_FOUND",
        "No receipt has been issued for this payment yet — it has not been verified.",
      );
    }

    const pdf = await buildReceiptPdf(payment, payment.receipt);

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${payment.receipt.receiptNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return toErrorResponse(error, "GET /receipt/[reference]/pdf");
  }
}
