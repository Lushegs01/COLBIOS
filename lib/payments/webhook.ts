import "server-only";

import { serverEnv } from "@/lib/env";
import { AppError } from "@/lib/http/api";
import { describeError, logger } from "@/lib/logger";
import { paystack } from "@/lib/paystack/client";
import { verifyWebhookSignature } from "@/lib/paystack/signature";
import type { PaystackWebhookEvent } from "@/lib/paystack/types";
import type { Prisma } from "@/lib/generated/prisma/client";

import {
  applyUnsuccessfulStatus,
  fulfilPayment,
  markEventProcessed,
  recordPaymentEvent,
} from "./service";
import type { PaymentStatusValue } from "./state";

/**
 * Webhook processing — the authoritative, asynchronous fulfilment path.
 *
 * Order of operations, and why:
 *  1. Verify the signature over the raw body. An unsigned request is discarded
 *     before it can touch the database.
 *  2. Insert the event under a unique provider event id. A duplicate delivery
 *     loses that race and is acknowledged without being processed again.
 *  3. Re-verify the transaction against Paystack's API. The webhook body tells
 *     us *that* something happened; the API tells us what is true.
 *  4. Fulfil inside a locked transaction (see service.fulfilPayment).
 */

export type WebhookOutcome =
  | { status: "processed"; reference: string }
  | { status: "duplicate"; reference: string }
  | { status: "ignored"; reason: string };

const FULFILLING_EVENTS = new Set(["charge.success"]);
const FAILURE_EVENTS: Record<string, PaymentStatusValue> = {
  "charge.failed": "FAILED",
  "charge.abandoned": "ABANDONED",
  "charge.reversed": "REVERSED",
  "refund.processed": "REFUNDED",
  "refund.failed": "SUCCESS",
};

export function parseWebhookBody(rawBody: string): PaystackWebhookEvent | null {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object") return null;
    const event = parsed as PaystackWebhookEvent;
    if (typeof event.event !== "string" || !event.data || typeof event.data !== "object") {
      return null;
    }
    return event;
  } catch {
    return null;
  }
}

/**
 * A stable identity for an event delivery. Paystack does not send an event id
 * header, so we derive one from the event type and the transaction id — the
 * pair a retry of the same event always repeats.
 */
export function providerEventId(event: PaystackWebhookEvent): string {
  const id = event.data?.id ?? event.data?.reference ?? "unknown";
  return `${event.event}:${id}`;
}

export async function handleWebhook(
  rawBody: string,
  signature: string | null,
): Promise<WebhookOutcome> {
  if (!verifyWebhookSignature(rawBody, signature, serverEnv.paystackSecretKey)) {
    logger.warn("webhook_signature_invalid", { bodyBytes: rawBody.length });
    throw new AppError("FORBIDDEN", "Invalid signature.");
  }

  const event = parseWebhookBody(rawBody);
  if (!event) {
    logger.warn("webhook_processing_failed", { reason: "unparseable_body" });
    throw new AppError("INVALID_REQUEST", "Malformed event payload.");
  }

  const reference = typeof event.data.reference === "string" ? event.data.reference.trim() : "";
  logger.info("webhook_received", { eventType: event.event, reference });

  if (!reference) {
    return { status: "ignored", reason: "no_reference" };
  }

  const eventId = providerEventId(event);
  const stored = await recordPaymentEvent({
    providerEventId: eventId,
    source: "WEBHOOK",
    eventType: event.event,
    reference,
    payload: event as unknown as Prisma.InputJsonValue,
    processed: false,
  });

  if (!stored) {
    logger.info("duplicate_webhook_ignored", { eventType: event.event, reference });
    return { status: "duplicate", reference };
  }

  try {
    if (FULFILLING_EVENTS.has(event.event)) {
      // Never trust the amount in the webhook body — ask the provider directly.
      const transaction = await paystack.verifyTransaction(reference);
      const outcome = await fulfilPayment(reference, transaction, "WEBHOOK");
      await markEventProcessed(eventId, { paymentId: outcome.payment.id });
      logger.info("webhook_processed", { eventType: event.event, reference });
      return { status: "processed", reference };
    }

    const mapped = FAILURE_EVENTS[event.event];
    if (mapped) {
      const gatewayResponse =
        typeof event.data.gateway_response === "string" ? event.data.gateway_response : null;
      const payment = await applyUnsuccessfulStatus(reference, mapped, gatewayResponse);
      await markEventProcessed(eventId, { paymentId: payment?.id ?? null });
      logger.info("webhook_processed", { eventType: event.event, reference, mapped });
      return { status: "processed", reference };
    }

    await markEventProcessed(eventId, {});
    return { status: "ignored", reason: `unhandled_event:${event.event}` };
  } catch (error) {
    // Record why it failed and let Paystack retry — the event row keeps the
    // failure so an operator can see what happened.
    await markEventProcessed(eventId, {
      error: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
    });
    logger.error("webhook_processing_failed", {
      eventType: event.event,
      reference,
      ...describeError(error),
    });
    throw error;
  }
}
