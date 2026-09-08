import "server-only";

import { prisma } from "@/lib/db/prisma";
import { describeError, logger } from "@/lib/logger";
import type { Payment, Receipt } from "@/lib/generated/prisma/client";

import { sendPaymentConfirmation } from "./send";

/**
 * Exactly-once confirmation email.
 *
 * A payment can be fulfilled by the webhook, by the callback's verification, or
 * by both in either order. Whichever path gets there first claims the right to
 * send by winning a conditional UPDATE on `confirmationEmailSentAt`; the others
 * see a claim count of zero and do nothing.
 *
 * If sending then fails, the claim is released so a later verification can try
 * again — a bounced email must not permanently silence the confirmation.
 */
export async function dispatchConfirmationEmail(
  payment: Payment,
  receipt: Receipt,
): Promise<void> {
  let claimed = false;

  try {
    const result = await prisma.payment.updateMany({
      where: { id: payment.id, confirmationEmailSentAt: null, status: "SUCCESS" },
      data: { confirmationEmailSentAt: new Date() },
    });
    claimed = result.count === 1;
  } catch (error) {
    logger.error("email_failed", {
      reference: payment.reference,
      stage: "claim",
      ...describeError(error),
    });
    return;
  }

  if (!claimed) {
    logger.info("email_skipped", { reference: payment.reference, reason: "already_sent" });
    return;
  }

  const outcome = await sendPaymentConfirmation(payment, receipt);

  if (!outcome.sent) {
    await prisma.payment
      .updateMany({ where: { id: payment.id }, data: { confirmationEmailSentAt: null } })
      .catch(() => undefined);
  }
}

/** Fire-and-forget form used on request paths. Never rejects. */
export function dispatchConfirmationEmailInBackground(payment: Payment, receipt: Receipt): void {
  void dispatchConfirmationEmail(payment, receipt).catch((error) => {
    logger.error("email_failed", { reference: payment.reference, ...describeError(error) });
  });
}
