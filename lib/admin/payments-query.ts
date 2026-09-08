import "server-only";

import { prisma } from "@/lib/db/prisma";
import { normaliseMatric, type PaymentFilterInput } from "@/lib/validation/schemas";
import { Prisma } from "@/lib/generated/prisma/client";

/**
 * The payment search used by the admin table, the JSON API and the CSV export.
 *
 * One query builder for all three, so a filter can never mean one thing on
 * screen and another in an export a finance officer reconciles against.
 */

export const PAGE_SIZE = 25;

export function buildPaymentWhere(filter: PaymentFilterInput): Prisma.PaymentWhereInput {
  const where: Prisma.PaymentWhereInput = {};

  if (filter.status) where.status = filter.status;
  if (filter.sessionId) where.sessionId = filter.sessionId;
  if (filter.departmentId) where.departmentId = filter.departmentId;
  if (filter.level) where.level = filter.level;
  if (filter.channel) where.channel = filter.channel;

  if (filter.from || filter.to) {
    where.createdAt = {
      ...(filter.from ? { gte: new Date(`${filter.from}T00:00:00.000Z`) } : {}),
      ...(filter.to ? { lte: new Date(`${filter.to}T23:59:59.999Z`) } : {}),
    };
  }

  const query = filter.q?.trim();
  if (query) {
    // Search by reference, matric number or name. Matric matching uses the
    // normalised column so "2023/123456" and "2023123456" both find the row.
    where.OR = [
      { reference: { contains: query.toUpperCase() } },
      { matricNormal: { contains: normaliseMatric(query) } },
      { fullName: { contains: query, mode: "insensitive" } },
      { receipt: { receiptNumber: { contains: query.toUpperCase() } } },
    ];
  }

  return where;
}

export type AdminPaymentRow = {
  id: string;
  reference: string;
  fullName: string;
  matricNumber: string;
  email: string;
  departmentName: string;
  level: string;
  sessionName: string;
  feeName: string;
  amount: number;
  currency: string;
  status: string;
  channel: string | null;
  paidAt: Date | null;
  createdAt: Date;
  isManualAdjustment: boolean;
  receiptNumber: string | null;
};

export async function findPayments(
  filter: PaymentFilterInput,
  options: { page?: number; take?: number } = {},
): Promise<{ rows: AdminPaymentRow[]; total: number; page: number; pages: number }> {
  const where = buildPaymentWhere(filter);
  const take = options.take ?? PAGE_SIZE;
  const page = options.page ?? filter.page ?? 1;

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
      // Explicit select: the admin table shows no more than it needs, and the
      // receipt is joined rather than fetched per row (no N+1).
      select: {
        id: true,
        reference: true,
        fullName: true,
        matricNumber: true,
        email: true,
        departmentName: true,
        level: true,
        sessionName: true,
        feeName: true,
        amount: true,
        currency: true,
        status: true,
        channel: true,
        paidAt: true,
        createdAt: true,
        isManualAdjustment: true,
        receipt: { select: { receiptNumber: true } },
      },
    }),
  ]);

  return {
    rows: payments.map((payment) => ({
      ...payment,
      receiptNumber: payment.receipt?.receiptNumber ?? null,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / take)),
  };
}

/**
 * Stream-friendly export: pulls in pages rather than loading every payment into
 * memory at once, so a full-session export cannot exhaust the function's heap.
 */
export async function* iteratePaymentsForExport(
  filter: PaymentFilterInput,
  batchSize = 500,
): AsyncGenerator<AdminPaymentRow[]> {
  const where = buildPaymentWhere(filter);
  let cursor: string | undefined;

  for (;;) {
    const batch = await prisma.payment.findMany({
      where,
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        reference: true,
        fullName: true,
        matricNumber: true,
        email: true,
        departmentName: true,
        level: true,
        sessionName: true,
        feeName: true,
        amount: true,
        currency: true,
        status: true,
        channel: true,
        paidAt: true,
        createdAt: true,
        isManualAdjustment: true,
        receipt: { select: { receiptNumber: true } },
      },
    });

    if (batch.length === 0) return;

    yield batch.map((payment) => ({
      ...payment,
      receiptNumber: payment.receipt?.receiptNumber ?? null,
    }));

    if (batch.length < batchSize) return;
    cursor = batch[batch.length - 1]!.id;
  }
}
