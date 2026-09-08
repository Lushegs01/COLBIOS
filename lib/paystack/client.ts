import "server-only";

import { serverEnv } from "@/lib/env";
import { AppError } from "@/lib/http/api";
import { describeError, logger } from "@/lib/logger";

import type {
  PaystackEnvelope,
  PaystackInitializeData,
  PaystackInitializeRequest,
  PaystackTransaction,
} from "./types";

/**
 * Paystack HTTP client.
 *
 * The secret key is read here and nowhere else in the request path. This module
 * is `server-only`; it cannot be pulled into a client bundle even by accident.
 */

const PAYSTACK_LIVE_BASE_URL = "https://api.paystack.co";
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * The API base URL.
 *
 * PAYSTACK_BASE_URL exists so a developer can point the app at a local mock
 * while working offline. It is ignored in production: a deployment must never
 * be able to send a real transaction anywhere but Paystack, whatever ends up in
 * its environment.
 */
function baseUrl(): string {
  if (process.env.NODE_ENV === "production") return PAYSTACK_LIVE_BASE_URL;
  return (process.env.PAYSTACK_BASE_URL ?? PAYSTACK_LIVE_BASE_URL).replace(/\/+$/, "");
}

type RequestOptions = {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  /** Retries are only ever used for idempotent (GET) calls. */
  retries?: number;
};

async function paystackRequest<T>({
  method,
  path,
  body,
  retries = 0,
}: RequestOptions): Promise<PaystackEnvelope<T>> {
  const url = `${baseUrl()}${path}`;
  let lastNetworkError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${serverEnv.paystackSecretKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });

      const text = await response.text();
      let payload: PaystackEnvelope<T> | null = null;
      try {
        payload = text ? (JSON.parse(text) as PaystackEnvelope<T>) : null;
      } catch {
        payload = null;
      }

      if (!response.ok || !payload) {
        // 5xx from the provider is worth one more attempt on idempotent calls.
        if (response.status >= 500 && attempt < retries) {
          lastNetworkError = new Error(`Paystack responded ${response.status}`);
          await delay(250 * (attempt + 1));
          continue;
        }
        logger.error("paystack_request_failed", {
          path,
          status: response.status,
          providerMessage: payload?.message ?? "unparseable response",
        });
        throw new AppError(
          response.status >= 500 ? "PROVIDER_UNAVAILABLE" : "PROVIDER_ERROR",
          response.status >= 500
            ? "We could not reach the payment provider. Please try again in a moment."
            : "The payment provider rejected this request. Please try again.",
          { context: { path, status: response.status } },
        );
      }

      if (payload.status !== true) {
        logger.error("paystack_request_failed", {
          path,
          status: response.status,
          providerMessage: payload.message,
        });
        throw new AppError("PROVIDER_ERROR", "The payment provider returned an error.", {
          context: { path, providerMessage: payload.message },
        });
      }

      return payload;
    } catch (error) {
      if (error instanceof AppError) throw error;
      lastNetworkError = error;
      if (attempt < retries) {
        await delay(250 * (attempt + 1));
        continue;
      }
    }
  }

  logger.error("paystack_request_failed", { path, ...describeError(lastNetworkError) });
  throw new AppError(
    "PROVIDER_UNAVAILABLE",
    "We could not reach the payment provider. Please try again in a moment.",
    { context: { path } },
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Start a transaction. `amount` is in kobo and comes from the database — this
 * function is never called with a client-supplied amount.
 */
export async function initializeTransaction(
  request: PaystackInitializeRequest,
): Promise<PaystackInitializeData> {
  const payload = await paystackRequest<PaystackInitializeData>({
    method: "POST",
    path: "/transaction/initialize",
    body: request,
  });
  return payload.data;
}

/**
 * Fetch the provider's own record of a transaction. This — not a browser
 * redirect, not a webhook body — is what a payment's success is decided on.
 */
export async function verifyTransaction(reference: string): Promise<PaystackTransaction> {
  const payload = await paystackRequest<PaystackTransaction>({
    method: "GET",
    path: `/transaction/verify/${encodeURIComponent(reference)}`,
    retries: 2,
  });
  return payload.data;
}

export const paystack = { initializeTransaction, verifyTransaction };
export type PaystackApi = typeof paystack;
