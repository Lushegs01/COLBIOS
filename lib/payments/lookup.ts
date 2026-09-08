import "server-only";

import { prisma } from "@/lib/db/prisma";
import { levelLabel, type LevelCode } from "@/lib/format/level";
import type { PaymentStatusValue } from "@/lib/payments/state";

/**
 * Read models for the public pages.
 *
 * These shapes are what a payment looks like to the outside world: no database
 * ids, no webhook payloads, no admin fields, no email address on the public
 * verification view. Pages render these objects and nothing else, so a field
 * cannot leak by someone adding it to a query.
 */

export type PublicPaymentView = {
  reference: string;
  status: PaymentStatusValue;
  fullName: string;
  matricNumber: string;
  email: string;
  department: string;
  levelLabel: string;
  sessionName: string;
  feeName: string;
  amount: number;
  currency: string;
  channel: string | null;
  paidAt: Date | null;
  createdAt: Date;
  receiptNumber: string | null;
  receiptIssuedAt: Date | null;
  isManualAdjustment: boolean;
};

export async function findPublicPayment(reference: string): Promise<PublicPaymentView | null> {
  const payment = await prisma.payment.findUnique({
    where: { reference },
    include: { receipt: true },
  });

  if (!payment) return null;

  return {
    reference: payment.reference,
    status: payment.status as PaymentStatusValue,
    fullName: payment.fullName,
    matricNumber: payment.matricNumber,
    email: payment.email,
    department: payment.departmentName,
    levelLabel: levelLabel(payment.level as LevelCode),
    sessionName: payment.sessionName,
    feeName: payment.feeName,
    amount: payment.amount,
    currency: payment.currency,
    channel: payment.channel,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
    receiptNumber: payment.receipt?.receiptNumber ?? null,
    receiptIssuedAt: payment.receipt?.issuedAt ?? null,
    isManualAdjustment: payment.isManualAdjustment,
  };
}

/**
 * The even narrower view used by the public verification page. A matric number
 * is partially masked: enough for the holder of the receipt to recognise it,
 * not enough to harvest.
 */
export type VerificationView = {
  reference: string;
  status: PaymentStatusValue;
  verified: boolean;
  fullName: string;
  maskedMatric: string;
  department: string;
  levelLabel: string;
  sessionName: string;
  feeName: string;
  amount: number;
  currency: string;
  paidAt: Date | null;
  receiptNumber: string | null;
  isManualAdjustment: boolean;
};

export function toVerificationView(payment: PublicPaymentView): VerificationView {
  return {
    reference: payment.reference,
    status: payment.status,
    verified: payment.status === "SUCCESS" && payment.receiptNumber !== null,
    fullName: payment.fullName,
    maskedMatric: maskMatric(payment.matricNumber),
    department: payment.department,
    levelLabel: payment.levelLabel,
    sessionName: payment.sessionName,
    feeName: payment.feeName,
    amount: payment.amount,
    currency: payment.currency,
    paidAt: payment.paidAt,
    receiptNumber: payment.receiptNumber,
    isManualAdjustment: payment.isManualAdjustment,
  };
}

/** 2023/123456 -> 2023/12••56 */
export function maskMatric(matric: string): string {
  if (matric.length <= 5) return matric;
  return `${matric.slice(0, matric.length - 4)}••${matric.slice(-2)}`;
}
