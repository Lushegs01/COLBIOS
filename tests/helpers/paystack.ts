import { vi } from "vitest";

import { computeWebhookSignature } from "@/lib/paystack/signature";
import type { PaystackTransaction } from "@/lib/paystack/types";

/**
 * A stand-in for the Paystack API.
 *
 * `global.fetch` is replaced so the payment code under test makes exactly the
 * calls it would in production — same URLs, same bodies — while the responses
 * come from these fixtures. Nothing leaves the machine, and no Paystack
 * credentials are needed to run the suite.
 */

export const TEST_SECRET_KEY = "sk_test_vitest_fixture_key";

export type PaystackStub = {
  /** Every request the code under test made, in order. */
  calls: Array<{ url: string; method: string; body: unknown }>;
  /** Queue a transaction to be returned by the next verify call. */
  setTransaction: (transaction: Partial<PaystackTransaction> & { reference: string }) => void;
  /** Make the next call fail as if Paystack were unreachable. */
  failNext: (mode: "network" | "500" | "status-false") => void;
  restore: () => void;
};

export function stubPaystack(): PaystackStub {
  const original = global.fetch;
  const calls: PaystackStub["calls"] = [];
  let transaction: PaystackTransaction | null = null;
  let failure: "network" | "500" | "status-false" | null = null;

  const stub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method: init?.method ?? "GET", body });

    if (failure === "network") {
      failure = null;
      throw new TypeError("fetch failed");
    }
    if (failure === "500") {
      failure = null;
      return jsonResponse({ status: false, message: "Server error" }, 500);
    }
    if (failure === "status-false") {
      failure = null;
      return jsonResponse({ status: false, message: "Transaction not found" }, 200);
    }

    if (url.includes("/transaction/initialize")) {
      const reference = String(body?.reference ?? "");
      return jsonResponse({
        status: true,
        message: "Authorization URL created",
        data: {
          authorization_url: `https://checkout.paystack.com/${reference.toLowerCase()}`,
          access_code: "access_code_fixture",
          reference,
        },
      });
    }

    if (url.includes("/transaction/verify/")) {
      const reference = decodeURIComponent(url.split("/transaction/verify/")[1] ?? "");
      const data =
        transaction && transaction.reference === reference
          ? transaction
          : { ...defaultTransaction(reference), status: "abandoned" };
      return jsonResponse({ status: true, message: "Verification successful", data });
    }

    throw new Error(`Unexpected request in test: ${url}`);
  });

  global.fetch = stub as unknown as typeof fetch;

  return {
    calls,
    setTransaction(partial) {
      transaction = { ...defaultTransaction(partial.reference), ...partial };
    },
    failNext(mode) {
      failure = mode;
    },
    restore() {
      global.fetch = original;
    },
  };
}

export function defaultTransaction(reference: string): PaystackTransaction {
  return {
    id: 1_234_567_890,
    status: "success",
    reference,
    amount: 600_000,
    currency: "NGN",
    channel: "card",
    paid_at: "2026-09-08T10:00:00.000Z",
    created_at: "2026-09-08T09:59:00.000Z",
    gateway_response: "Successful",
    customer: { email: "john.doe@example.com" },
  };
}

/** Build a webhook body and its matching signature header. */
export function signedWebhook(
  event: string,
  data: Record<string, unknown>,
  secret = TEST_SECRET_KEY,
): { body: string; signature: string } {
  const body = JSON.stringify({ event, data });
  return { body, signature: computeWebhookSignature(body, secret) };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
