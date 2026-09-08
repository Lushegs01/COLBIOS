import "server-only";

import { Resend } from "resend";

import { absoluteUrl, serverEnv } from "@/lib/env";
import { describeError, logger } from "@/lib/logger";
import { levelLabel, type LevelCode } from "@/lib/format/level";
import { buildReceiptPdf } from "@/lib/receipts/pdf";
import type { Payment, Receipt } from "@/lib/generated/prisma/client";

import {
  confirmationHtml,
  confirmationSubject,
  confirmationText,
  type ConfirmationEmailData,
} from "./templates";

/**
 * Outbound email.
 *
 * Email is a *side effect* of a successful payment, never a precondition. Every
 * function here swallows its own failures and reports them through the logger:
 * a Resend outage must not turn a verified payment into a failed one.
 */

let client: Resend | null = null;

function resend(): Resend | null {
  if (!serverEnv.emailEnabled) return null;
  client ??= new Resend(serverEnv.resendApiKey);
  return client;
}

export type SendResult = { sent: boolean; reason?: string };

export async function sendPaymentConfirmation(
  payment: Payment,
  receipt: Receipt,
): Promise<SendResult> {
  const mailer = resend();
  if (!mailer) {
    logger.info("email_skipped", {
      reference: payment.reference,
      reason: "email_not_configured",
    });
    return { sent: false, reason: "email_not_configured" };
  }

  const data: ConfirmationEmailData = {
    fullName: payment.fullName,
    matricNumber: payment.matricNumber,
    department: payment.departmentName,
    levelLabel: levelLabel(payment.level as LevelCode),
    sessionName: payment.sessionName,
    feeName: payment.feeName,
    amount: payment.amount,
    currency: payment.currency,
    reference: payment.reference,
    receiptNumber: receipt.receiptNumber,
    paidAt: payment.paidAt ?? receipt.issuedAt,
    channel: payment.channel,
    receiptUrl: absoluteUrl(`/receipt/${payment.reference}`),
    verifyUrl: absoluteUrl(`/verify/${payment.reference}`),
  };

  try {
    // The PDF is attached where we can build it, but a failure to render it
    // must not stop the confirmation going out.
    let attachments: Array<{ filename: string; content: string }> | undefined;
    try {
      const pdf = await buildReceiptPdf(payment, receipt);
      attachments = [
        {
          filename: `${receipt.receiptNumber}.pdf`,
          content: Buffer.from(pdf).toString("base64"),
        },
      ];
    } catch (error) {
      logger.warn("email_failed", {
        reference: payment.reference,
        stage: "pdf_attachment",
        ...describeError(error),
      });
    }

    const result = await mailer.emails.send({
      from: serverEnv.fromEmail,
      to: payment.email,
      subject: confirmationSubject(data),
      html: confirmationHtml(data),
      text: confirmationText(data),
      ...(attachments ? { attachments } : {}),
    });

    if (result.error) {
      logger.error("email_failed", {
        reference: payment.reference,
        providerMessage: result.error.message,
      });
      return { sent: false, reason: "provider_error" };
    }

    logger.info("email_sent", { reference: payment.reference, receiptNumber: receipt.receiptNumber });
    return { sent: true };
  } catch (error) {
    logger.error("email_failed", { reference: payment.reference, ...describeError(error) });
    return { sent: false, reason: "exception" };
  }
}

/**
 * Fire-and-forget wrapper used on the fulfilment path. Returns immediately; the
 * promise is intentionally not awaited by the caller's response.
 */
export function sendPaymentConfirmationInBackground(payment: Payment, receipt: Receipt): void {
  void sendPaymentConfirmation(payment, receipt).catch((error) => {
    logger.error("email_failed", { reference: payment.reference, ...describeError(error) });
  });
}
