import { createHmac } from "node:crypto";
import { createServer } from "node:http";

/**
 * A local stand-in for the Paystack API, for developing and demonstrating the
 * full flow without a network or live credentials.
 *
 * It implements only what this application calls:
 *   POST /transaction/initialize
 *   GET  /transaction/verify/:reference
 * plus a helper endpoint that fires a correctly-signed webhook at the app, so
 * the asynchronous fulfilment path can be exercised the same way Paystack
 * exercises it in production.
 *
 * Point the app at it with PAYSTACK_BASE_URL=http://127.0.0.1:4010 — an
 * override the client ignores when NODE_ENV is production.
 *
 * Usage: npm run mock:paystack
 */

const PORT = Number(process.env.MOCK_PAYSTACK_PORT ?? 4010);
const SECRET = process.env.PAYSTACK_SECRET_KEY ?? "sk_test_local_placeholder_not_a_real_key";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";

type Transaction = {
  id: number;
  status: "success" | "failed" | "abandoned" | "ongoing";
  reference: string;
  amount: number;
  currency: string;
  channel: string;
  paid_at: string | null;
  created_at: string;
  gateway_response: string;
  customer: { email: string };
  metadata: unknown;
};

const transactions = new Map<string, Transaction>();
let nextId = 700_000_000;

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);
  const body = await readBody(request);

  const json = (status: number, payload: unknown) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(payload));
  };

  // --- Paystack API surface -------------------------------------------------
  if (request.method === "POST" && url.pathname === "/transaction/initialize") {
    const payload = JSON.parse(body || "{}");
    nextId += 1;

    transactions.set(payload.reference, {
      id: nextId,
      // Starts unsettled, exactly like a real checkout the student has not
      // completed yet.
      status: "ongoing",
      reference: payload.reference,
      amount: payload.amount,
      currency: payload.currency,
      channel: "card",
      paid_at: null,
      created_at: new Date().toISOString(),
      gateway_response: "Pending",
      customer: { email: payload.email },
      metadata: payload.metadata,
    });

    return json(200, {
      status: true,
      message: "Authorization URL created",
      data: {
        authorization_url: `http://127.0.0.1:${PORT}/checkout/${payload.reference}`,
        access_code: `mock_${payload.reference}`,
        reference: payload.reference,
      },
    });
  }

  if (request.method === "GET" && url.pathname.startsWith("/transaction/verify/")) {
    const reference = decodeURIComponent(url.pathname.split("/transaction/verify/")[1] ?? "");
    const transaction = transactions.get(reference);

    if (!transaction) {
      return json(404, { status: false, message: "Transaction reference not found" });
    }
    return json(200, { status: true, message: "Verification successful", data: transaction });
  }

  // --- Test controls --------------------------------------------------------

  /** Mark a transaction paid (what completing checkout would do). */
  if (request.method === "POST" && url.pathname.startsWith("/_control/pay/")) {
    const reference = decodeURIComponent(url.pathname.split("/_control/pay/")[1] ?? "");
    const transaction = transactions.get(reference);
    if (!transaction) return json(404, { status: false, message: "Unknown reference" });

    const amountOverride = url.searchParams.get("amount");
    transaction.status = "success";
    transaction.paid_at = new Date().toISOString();
    transaction.gateway_response = "Successful";
    transaction.channel = url.searchParams.get("channel") ?? "card";
    if (amountOverride) transaction.amount = Number(amountOverride);

    return json(200, { status: true, data: transaction });
  }

  /** Mark a transaction failed. */
  if (request.method === "POST" && url.pathname.startsWith("/_control/fail/")) {
    const reference = decodeURIComponent(url.pathname.split("/_control/fail/")[1] ?? "");
    const transaction = transactions.get(reference);
    if (!transaction) return json(404, { status: false, message: "Unknown reference" });

    transaction.status = "failed";
    transaction.gateway_response = "Declined by bank";
    return json(200, { status: true, data: transaction });
  }

  /** Deliver a signed webhook to the application, as Paystack would. */
  if (request.method === "POST" && url.pathname.startsWith("/_control/webhook/")) {
    const reference = decodeURIComponent(url.pathname.split("/_control/webhook/")[1] ?? "");
    const transaction = transactions.get(reference);
    if (!transaction) return json(404, { status: false, message: "Unknown reference" });

    const event = url.searchParams.get("event") ?? "charge.success";
    const payload = JSON.stringify({ event, data: transaction });
    const signature = createHmac("sha512", SECRET).update(payload, "utf8").digest("hex");

    const delivery = await fetch(`${APP_URL}/api/payments/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-paystack-signature": signature },
      body: payload,
    });

    return json(200, {
      status: true,
      data: { delivered: delivery.status, response: await delivery.text() },
    });
  }

  /** A stand-in checkout page, so the redirect can be followed by hand. */
  if (request.method === "GET" && url.pathname.startsWith("/checkout/")) {
    const reference = decodeURIComponent(url.pathname.split("/checkout/")[1] ?? "");
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return response.end(
      `<!doctype html><meta charset="utf-8"><title>Mock checkout</title>
       <body style="font-family:system-ui;padding:2rem;max-width:32rem">
       <h1>Mock Paystack checkout</h1>
       <p>Reference: <code>${escapeHtml(reference)}</code></p>
       <p>This is the local mock, not Paystack. Use the control endpoints to
       mark the transaction paid, then return to the app's callback.</p>
       </body>`,
    );
  }

  json(404, { status: false, message: "Not implemented in the mock" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    [
      `Mock Paystack listening on http://127.0.0.1:${PORT}`,
      "",
      "  Run the app with:",
      `    PAYSTACK_BASE_URL=http://127.0.0.1:${PORT} npm run dev`,
      "",
      "  Controls:",
      `    POST /_control/pay/:reference[?amount=&channel=]  mark paid`,
      `    POST /_control/fail/:reference                    mark failed`,
      `    POST /_control/webhook/:reference[?event=]        deliver a signed webhook`,
      "",
    ].join("\n"),
  );
});

function readBody(request: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    request.on("data", (chunk) => (data += chunk));
    request.on("end", () => resolve(data));
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}
