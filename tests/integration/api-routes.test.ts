import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST as initializeRoute } from "@/app/api/payments/initialize/route";
import { POST as quoteRoute } from "@/app/api/payments/quote/route";
import { POST as verifyRoute } from "@/app/api/payments/verify/route";
import { POST as webhookRoute } from "@/app/api/payments/webhook/route";
import { prisma } from "@/lib/db/prisma";

import { resetDatabase, seedFixtures, type Fixtures } from "../helpers/db";
import { signedWebhook, stubPaystack, type PaystackStub } from "../helpers/paystack";

/**
 * The HTTP layer, exercised through the real route handlers.
 *
 * This is where the response envelope, the rate limits and the error mapping
 * are checked — the parts a browser actually sees. The service layer beneath is
 * covered separately in payment-flow.test.ts.
 */
describe("public payment API", () => {
  let fixtures: Fixtures;
  let paystack: PaystackStub;

  beforeEach(async () => {
    await resetDatabase();
    fixtures = await seedFixtures();
    paystack = stubPaystack();
  });

  afterEach(() => paystack.restore());
  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** Each test gets its own client IP so rate-limit buckets do not overlap. */
  let ipCounter = 0;
  function post(url: string, body: unknown, headers: Record<string, string> = {}) {
    ipCounter += 1;
    return new NextRequest(`http://localhost:3000${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `10.0.0.${ipCounter}`,
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  const validBody = () => ({
    fullName: "John Doe",
    matricNumber: "2023/123456",
    email: "john.doe@example.com",
    departmentId: fixtures.department.id,
    level: "300L",
  });

  describe("POST /api/payments/quote", () => {
    it("returns the amount the server determined", async () => {
      const response = await quoteRoute(post("/api/payments/quote", validBody()));
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.data.amount).toBe(fixtures.amounts.L300);
      expect(payload.data.levelLabel).toBe("300L");
      expect(payload.data.sessionName).toBe("2026/2027");
    });

    it("exposes no internal identifiers beyond the department the form already had", async () => {
      const response = await quoteRoute(post("/api/payments/quote", validBody()));
      const payload = await response.json();

      expect(payload.data).not.toHaveProperty("feeId");
      expect(payload.data).not.toHaveProperty("sessionId");
      expect(payload.data).not.toHaveProperty("id");
    });

    it("returns field-level errors for an invalid submission", async () => {
      const response = await quoteRoute(
        post("/api/payments/quote", { ...validBody(), email: "nope", level: "900L" }),
      );
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
      expect(payload.error.code).toBe("VALIDATION_ERROR");
      expect(Object.keys(payload.error.details)).toContain("email");
      expect(Object.keys(payload.error.details)).toContain("level");
    });

    it("rejects a malformed body without leaking an exception", async () => {
      const response = await quoteRoute(post("/api/payments/quote", "{not json"));
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.error.code).toBe("INVALID_REQUEST");
      expect(JSON.stringify(payload)).not.toMatch(/SyntaxError|JSON\.parse|at Object/);
    });
  });

  describe("POST /api/payments/initialize", () => {
    it("returns an authorization URL for a valid submission", async () => {
      const response = await initializeRoute(post("/api/payments/initialize", validBody()));
      const payload = await response.json();

      expect(payload.success).toBe(true);
      expect(payload.data.authorizationUrl).toContain("checkout.paystack.com");
      expect(payload.data.amount).toBe(fixtures.amounts.L300);
    });

    it("ignores an amount supplied by the caller", async () => {
      const response = await initializeRoute(
        post("/api/payments/initialize", { ...validBody(), amount: 100 }),
      );
      const payload = await response.json();

      expect(payload.data.amount).toBe(fixtures.amounts.L300);
      const initializeCall = paystack.calls.find((call) => call.url.includes("initialize"));
      expect((initializeCall?.body as { amount: number }).amount).toBe(fixtures.amounts.L300);
    });

    it("rate limits repeated attempts from one client", async () => {
      const ip = "203.0.113.9";
      const attempt = (index: number) =>
        initializeRoute(
          new NextRequest("http://localhost:3000/api/payments/initialize", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
            body: JSON.stringify({
              ...validBody(),
              matricNumber: `2023/00000${index}`,
              email: `student${index}@example.com`,
            }),
          }),
        );

      const statuses: number[] = [];
      for (let index = 0; index < 7; index += 1) {
        statuses.push((await attempt(index)).status);
      }

      expect(statuses.filter((status) => status === 429).length).toBeGreaterThan(0);

      const limited = await attempt(99);
      const payload = await limited.json();
      expect(payload.error.code).toBe("RATE_LIMITED");
      expect(payload.error.message).toMatch(/try again/i);
      // The message must not describe the limiter's internals.
      expect(payload.error.message).not.toMatch(/bucket|window|redis|postgres/i);
    });

    it("tells a student who has already paid, with a 409", async () => {
      const first = await initializeRoute(post("/api/payments/initialize", validBody()));
      const { data } = await first.json();

      paystack.setTransaction({
        reference: data.reference,
        amount: fixtures.amounts.L300,
        status: "success",
      });
      await verifyRoute(post("/api/payments/verify", { reference: data.reference }));

      const second = await initializeRoute(post("/api/payments/initialize", validBody()));
      const payload = await second.json();

      expect(second.status).toBe(409);
      expect(payload.error.code).toBe("PAYMENT_ALREADY_COMPLETED");
    });
  });

  describe("POST /api/payments/verify", () => {
    it("confirms a successful payment and reports the receipt number", async () => {
      const initialized = await initializeRoute(post("/api/payments/initialize", validBody()));
      const { data } = await initialized.json();

      paystack.setTransaction({
        reference: data.reference,
        amount: fixtures.amounts.L300,
        status: "success",
      });

      const response = await verifyRoute(post("/api/payments/verify", { reference: data.reference }));
      const payload = await response.json();

      expect(payload.success).toBe(true);
      expect(payload.data.status).toBe("SUCCESS");
      expect(payload.data.receiptNumber).toMatch(/^COLBIOS-REC-\d{4}-\d{6}$/);
    });

    it("rejects a malformed reference before touching the database", async () => {
      const response = await verifyRoute(post("/api/payments/verify", { reference: "../../etc" }));
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.error.code).toBe("INVALID_REFERENCE");
    });

    it("returns a safe message for an unknown reference", async () => {
      const response = await verifyRoute(
        post("/api/payments/verify", { reference: "COLBIOS-2026-ZZZZZZZZ" }),
      );
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.error.code).toBe("PAYMENT_NOT_FOUND");
    });
  });

  describe("POST /api/payments/webhook", () => {
    function webhookRequest(body: string, signature: string | null) {
      return new NextRequest("http://localhost:3000/api/payments/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(signature ? { "x-paystack-signature": signature } : {}),
        },
        body,
      });
    }

    it("answers 400 to an unsigned request and records nothing", async () => {
      const { body } = signedWebhook("charge.success", { id: 1, reference: "COLBIOS-2026-AAAA1111" });
      const response = await webhookRoute(webhookRequest(body, null));

      expect(response.status).toBe(400);
      expect(await prisma.paymentEvent.count()).toBe(0);
    });

    it("answers 200 and fulfils a correctly signed charge.success", async () => {
      const initialized = await initializeRoute(post("/api/payments/initialize", validBody()));
      const { data } = await initialized.json();

      paystack.setTransaction({
        reference: data.reference,
        amount: fixtures.amounts.L300,
        status: "success",
      });

      const { body, signature } = signedWebhook("charge.success", {
        id: 424_242,
        reference: data.reference,
        status: "success",
        amount: fixtures.amounts.L300,
        currency: "NGN",
      });

      const response = await webhookRoute(webhookRequest(body, signature));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ received: true, status: "processed" });

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { reference: data.reference },
        include: { receipt: true },
      });
      expect(payment.status).toBe("SUCCESS");
      expect(payment.receipt).not.toBeNull();
    });

    it("answers 200 to a duplicate delivery so Paystack stops retrying", async () => {
      const initialized = await initializeRoute(post("/api/payments/initialize", validBody()));
      const { data } = await initialized.json();

      paystack.setTransaction({
        reference: data.reference,
        amount: fixtures.amounts.L300,
        status: "success",
      });

      const { body, signature } = signedWebhook("charge.success", {
        id: 515_151,
        reference: data.reference,
        status: "success",
        amount: fixtures.amounts.L300,
        currency: "NGN",
      });

      await webhookRoute(webhookRequest(body, signature));
      const duplicate = await webhookRoute(webhookRequest(body, signature));

      expect(duplicate.status).toBe(200);
      expect(await duplicate.json()).toMatchObject({ status: "duplicate" });
      expect(await prisma.receipt.count()).toBe(1);
    });

    it("answers 500 on a genuine processing failure so the provider retries", async () => {
      const initialized = await initializeRoute(post("/api/payments/initialize", validBody()));
      const { data } = await initialized.json();

      // Paystack's own record disagrees with the stored amount.
      paystack.setTransaction({ reference: data.reference, amount: 1, status: "success" });

      const { body, signature } = signedWebhook("charge.success", {
        id: 616_161,
        reference: data.reference,
        status: "success",
        amount: 1,
        currency: "NGN",
      });

      const response = await webhookRoute(webhookRequest(body, signature));
      expect(response.status).toBe(500);
      expect(await prisma.receipt.count()).toBe(0);
    });

    it("never echoes internal details back to the caller", async () => {
      const { body } = signedWebhook("charge.success", { id: 1, reference: "COLBIOS-2026-AAAA1111" });
      const response = await webhookRoute(webhookRequest(body, "bad-signature"));
      const payload = await response.json();

      expect(payload).toEqual({ received: false });
    });
  });
});
