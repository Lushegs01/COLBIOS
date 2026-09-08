import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/http/api";
import {
  findFulfilledPayment,
  fulfilPayment,
  initializePayment,
  quotePayment,
  recordManualAdjustment,
  verifyPaymentByReference,
} from "@/lib/payments/service";
import { handleWebhook } from "@/lib/payments/webhook";

import { resetDatabase, seedFixtures, studentSubmission, type Fixtures } from "../helpers/db";
import { defaultTransaction, signedWebhook, stubPaystack, type PaystackStub } from "../helpers/paystack";

/**
 * End-to-end payment behaviour against a real PostgreSQL database.
 *
 * These are the tests that matter most: they exercise the actual constraints,
 * the actual transactions and the actual idempotency keys, with only the
 * Paystack HTTP boundary replaced.
 */
describe("payment flow", () => {
  let fixtures: Fixtures;
  let paystack: PaystackStub;

  beforeEach(async () => {
    await resetDatabase();
    fixtures = await seedFixtures();
    paystack = stubPaystack();
  });

  afterEach(() => {
    paystack.restore();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const submission = () => ({ ...studentSubmission(), departmentId: fixtures.department.id });

  describe("quoting", () => {
    it("resolves the amount from the database, by level", async () => {
      const quote = await quotePayment(submission());

      expect(quote.fee.amount).toBe(fixtures.amounts.L300);
      expect(quote.fee.currency).toBe("NGN");
      expect(quote.session.name).toBe("2026/2027");
      expect(quote.levelLabel).toBe("300L");
      expect(quote.alreadyPaid).toBe(false);
    });

    it("gives each level its own configured amount", async () => {
      const l100 = await quotePayment({ ...submission(), level: "L100" });
      const l500 = await quotePayment({ ...submission(), level: "L500" });

      expect(l100.fee.amount).toBe(fixtures.amounts.L100);
      expect(l500.fee.amount).toBe(fixtures.amounts.L500);
      expect(l100.fee.amount).not.toBe(l500.fee.amount);
    });

    it("creates nothing — quoting twice leaves no payment rows", async () => {
      await quotePayment(submission());
      await quotePayment(submission());
      expect(await prisma.payment.count()).toBe(0);
    });

    it("refuses a department that is not on the approved list", async () => {
      await expect(
        quotePayment({ ...submission(), departmentId: fixtures.inactiveDepartment.id }),
      ).rejects.toMatchObject({ code: "INVALID_DEPARTMENT" });

      await expect(
        quotePayment({ ...submission(), departmentId: "clnonexistentdepartment" }),
      ).rejects.toMatchObject({ code: "INVALID_DEPARTMENT" });
    });

    it("refuses when no session is open", async () => {
      await prisma.academicSession.update({
        where: { id: fixtures.session.id },
        data: { active: false },
      });

      await expect(quotePayment(submission())).rejects.toMatchObject({
        code: "NO_ACTIVE_SESSION",
      });
    });

    it("refuses a level with no configured dues", async () => {
      await prisma.fee.updateMany({
        where: { sessionId: fixtures.session.id, level: "L300" },
        data: { active: false },
      });

      await expect(quotePayment(submission())).rejects.toMatchObject({
        code: "NO_FEE_CONFIGURED",
      });
    });
  });

  describe("initialization", () => {
    it("charges Paystack the database amount, not anything from the caller", async () => {
      const result = await initializePayment(submission());

      const initializeCall = paystack.calls.find((call) => call.url.includes("initialize"));
      expect(initializeCall?.body).toMatchObject({
        amount: fixtures.amounts.L300,
        currency: "NGN",
        reference: result.reference,
      });

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { reference: result.reference },
      });
      expect(payment.amount).toBe(fixtures.amounts.L300);
      expect(payment.status).toBe("PENDING");
      expect(payment.paystackTransactionId).toBeNull();
    });

    it("generates the reference server-side in the documented format", async () => {
      const result = await initializePayment(submission());
      expect(result.reference).toMatch(/^COLBIOS-2026-[0-9A-HJ-NP-TV-Z]{8}$/);
    });

    it("snapshots the configuration so later changes cannot rewrite history", async () => {
      const result = await initializePayment(submission());

      await prisma.fee.updateMany({
        where: { sessionId: fixtures.session.id, level: "L300" },
        data: { amount: 999_999, name: "Changed" },
      });
      await prisma.department.update({
        where: { id: fixtures.department.id },
        data: { name: "Renamed Department" },
      });

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { reference: result.reference },
      });
      expect(payment.amount).toBe(fixtures.amounts.L300);
      expect(payment.feeName).toBe("COLBIOS Dues");
      expect(payment.departmentName).toBe("Biochemistry");
    });

    it("reuses a live checkout instead of creating a second pending payment", async () => {
      const first = await initializePayment(submission());
      const second = await initializePayment(submission());

      expect(second.reference).toBe(first.reference);
      expect(second.reused).toBe(true);
      expect(await prisma.payment.count()).toBe(1);
    });

    it("marks the payment failed when the provider will not start a checkout", async () => {
      paystack.failNext("network");

      await expect(initializePayment(submission())).rejects.toMatchObject({
        code: "PROVIDER_UNAVAILABLE",
      });

      const payment = await prisma.payment.findFirstOrThrow();
      expect(payment.status).toBe("FAILED");
      expect(payment.authorizationUrl).toBeNull();
    });
  });

  describe("verification", () => {
    it("marks a payment successful only after the provider confirms it", async () => {
      const { reference } = await initializePayment(submission());

      paystack.setTransaction({ reference, amount: fixtures.amounts.L300, status: "success" });
      const result = await verifyPaymentByReference(reference);

      expect(result.state).toBe("SUCCESS");
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { reference },
        include: { receipt: true },
      });
      expect(payment.status).toBe("SUCCESS");
      expect(payment.paidAt).not.toBeNull();
      expect(payment.channel).toBe("card");
      expect(payment.paystackTransactionId).toBe("1234567890");
      expect(payment.receipt?.receiptNumber).toBe("COLBIOS-REC-2026-000001");
    });

    it("rejects a transaction whose amount does not match the dues", async () => {
      const { reference } = await initializePayment(submission());

      // A student who edited the amount at checkout, or a provider mismatch.
      paystack.setTransaction({ reference, amount: 100, status: "success" });

      await expect(verifyPaymentByReference(reference)).rejects.toMatchObject({
        code: "AMOUNT_MISMATCH",
      });

      const payment = await prisma.payment.findUniqueOrThrow({ where: { reference } });
      expect(payment.status).toBe("PENDING");
      expect(await prisma.receipt.count()).toBe(0);
    });

    it("rejects a transaction in the wrong currency", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({
        reference,
        amount: fixtures.amounts.L300,
        currency: "USD",
        status: "success",
      });

      await expect(verifyPaymentByReference(reference)).rejects.toMatchObject({
        code: "CURRENCY_MISMATCH",
      });
      expect(await prisma.receipt.count()).toBe(0);
    });

    it("leaves the payment pending when the provider has not settled it", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({ reference, amount: fixtures.amounts.L300, status: "ongoing" });

      const result = await verifyPaymentByReference(reference);
      expect(result.state).toBe("PENDING");
      expect((await prisma.payment.findUniqueOrThrow({ where: { reference } })).status).toBe("PENDING");
    });

    it("records a failed transaction as failed", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({
        reference,
        amount: fixtures.amounts.L300,
        status: "failed",
        gateway_response: "Insufficient funds",
      });

      const result = await verifyPaymentByReference(reference);
      expect(result.state).toBe("FAILED");

      const payment = await prisma.payment.findUniqueOrThrow({ where: { reference } });
      expect(payment.status).toBe("FAILED");
      expect(payment.failureReason).toBe("Insufficient funds");
    });

    it("is idempotent — verifying twice issues one receipt", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({ reference, amount: fixtures.amounts.L300, status: "success" });

      const first = await verifyPaymentByReference(reference);
      const second = await verifyPaymentByReference(reference);

      expect(first.state).toBe("SUCCESS");
      expect(second.state).toBe("SUCCESS");
      if (first.state === "SUCCESS" && second.state === "SUCCESS") {
        expect(second.newlyFulfilled).toBe(false);
        expect(second.receipt.receiptNumber).toBe(first.receipt.receiptNumber);
      }
      expect(await prisma.receipt.count()).toBe(1);
    });

    it("does not call the provider again once a payment is settled", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({ reference, amount: fixtures.amounts.L300, status: "success" });
      await verifyPaymentByReference(reference);

      const callsBefore = paystack.calls.length;
      await verifyPaymentByReference(reference);
      expect(paystack.calls.length).toBe(callsBefore);
    });

    it("reports an unknown reference without leaking whether it ever existed", async () => {
      await expect(verifyPaymentByReference("COLBIOS-2026-ZZZZZZZZ")).rejects.toMatchObject({
        code: "PAYMENT_NOT_FOUND",
      });
    });
  });

  describe("duplicate payments", () => {
    it("tells a student who has already paid, instead of charging again", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({ reference, amount: fixtures.amounts.L300, status: "success" });
      await verifyPaymentByReference(reference);

      const quote = await quotePayment(submission());
      expect(quote.alreadyPaid).toBe(true);
      expect(quote.existingReference).toBe(reference);

      await expect(initializePayment(submission())).rejects.toMatchObject({
        code: "PAYMENT_ALREADY_COMPLETED",
      });
      expect(await prisma.payment.count({ where: { status: "SUCCESS" } })).toBe(1);
    });

    it("matches duplicates on the normalised matric number", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({ reference, amount: fixtures.amounts.L300, status: "success" });
      await verifyPaymentByReference(reference);

      // Same student, typed with different spacing and case.
      const quote = await quotePayment({
        ...submission(),
        matricNumber: " 2023/123456 ",
        matricNormal: "2023/123456",
      });
      expect(quote.alreadyPaid).toBe(true);
    });

    it("refuses to attach one provider transaction to two payments", async () => {
      const first = await initializePayment(submission());
      paystack.setTransaction({
        reference: first.reference,
        id: 777_000_111,
        amount: fixtures.amounts.L300,
        status: "success",
      });
      await verifyPaymentByReference(first.reference);

      const second = await initializePayment({
        ...submission(),
        matricNumber: "2023/999999",
        matricNormal: "2023/999999",
        email: "second@example.com",
      });
      // The same Paystack transaction id reported for a different payment.
      paystack.setTransaction({
        reference: second.reference,
        id: 777_000_111,
        amount: fixtures.amounts.L300,
        status: "success",
      });

      await expect(verifyPaymentByReference(second.reference)).rejects.toMatchObject({
        code: "DUPLICATE_RESOURCE",
      });
      expect(await prisma.receipt.count()).toBe(1);
    });

    it("still allows a different student at the same level", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({ reference, amount: fixtures.amounts.L300, status: "success" });
      await verifyPaymentByReference(reference);

      const other = await initializePayment({
        ...submission(),
        matricNumber: "2023/654321",
        matricNormal: "2023/654321",
        email: "other@example.com",
      });
      expect(other.reference).not.toBe(reference);

      paystack.setTransaction({
        reference: other.reference,
        id: 555_000_222,
        amount: fixtures.amounts.L300,
        status: "success",
      });
      const result = await verifyPaymentByReference(other.reference);
      expect(result.state).toBe("SUCCESS");
      expect(await prisma.payment.count({ where: { status: "SUCCESS" } })).toBe(2);
    });

    it("is enforced by the database, not only by application checks", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({ reference, amount: fixtures.amounts.L300, status: "success" });
      await verifyPaymentByReference(reference);

      const paid = await prisma.payment.findUniqueOrThrow({ where: { reference } });

      // Bypass every application-level guard and write straight to the table.
      await expect(
        prisma.payment.create({
          data: {
            reference: "COLBIOS-2026-BYPASS01",
            fullName: paid.fullName,
            matricNumber: paid.matricNumber,
            matricNormal: paid.matricNormal,
            email: paid.email,
            departmentId: paid.departmentId,
            departmentName: paid.departmentName,
            level: paid.level,
            sessionId: paid.sessionId,
            sessionName: paid.sessionName,
            feeId: paid.feeId,
            feeName: paid.feeName,
            amount: paid.amount,
            currency: paid.currency,
            status: "SUCCESS",
          },
        }),
      ).rejects.toThrow();
    });

    it("prevents two concurrent fulfilments from both succeeding", async () => {
      const { reference } = await initializePayment(submission());
      const transaction = {
        ...defaultTransaction(reference),
        amount: fixtures.amounts.L300,
      };

      // Callback and webhook arriving at the same instant.
      const [a, b] = await Promise.all([
        fulfilPayment(reference, transaction, "VERIFY"),
        fulfilPayment(reference, transaction, "WEBHOOK"),
      ]);

      expect(a.receipt.receiptNumber).toBe(b.receipt.receiptNumber);
      expect([a.newlyFulfilled, b.newlyFulfilled].filter(Boolean)).toHaveLength(1);
      expect(await prisma.receipt.count()).toBe(1);
    });
  });

  describe("fulfilment guarantees", () => {
    it("never leaves a success without a receipt", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({ reference, amount: fixtures.amounts.L300, status: "success" });
      await verifyPaymentByReference(reference);

      const successes = await prisma.payment.findMany({
        where: { status: "SUCCESS" },
        include: { receipt: true },
      });
      expect(successes).toHaveLength(1);
      expect(successes[0].receipt).not.toBeNull();
    });

    it("numbers receipts sequentially without gaps", async () => {
      const matrics = ["2023/000001", "2023/000002", "2023/000003"];
      for (const [index, matric] of matrics.entries()) {
        const { reference } = await initializePayment({
          ...submission(),
          matricNumber: matric,
          matricNormal: matric,
          email: `${matric.replace("/", "")}@example.com`,
        });
        paystack.setTransaction({
          reference,
          id: 900_000_000 + index,
          amount: fixtures.amounts.L300,
          status: "success",
        });
        await verifyPaymentByReference(reference);
      }

      const receipts = await prisma.receipt.findMany({ orderBy: { receiptNumber: "asc" } });
      expect(receipts.map((receipt) => receipt.receiptNumber)).toEqual([
        "COLBIOS-REC-2026-000001",
        "COLBIOS-REC-2026-000002",
        "COLBIOS-REC-2026-000003",
      ]);
    });

    it("refuses to resurrect a refunded payment", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({ reference, amount: fixtures.amounts.L300, status: "success" });
      await verifyPaymentByReference(reference);

      await prisma.payment.update({ where: { reference }, data: { status: "REFUNDED" } });

      await expect(
        fulfilPayment(reference, { ...defaultTransaction(reference), amount: fixtures.amounts.L300 }, "WEBHOOK"),
      ).rejects.toThrow(/cannot move from REFUNDED to SUCCESS/);
    });
  });

  describe("webhooks", () => {
    const chargeSuccess = (reference: string, amount: number, id = 1_234_567_890) => ({
      id,
      reference,
      status: "success",
      amount,
      currency: "NGN",
      channel: "card",
      paid_at: "2026-09-08T10:00:00.000Z",
    });

    it("rejects a body with no signature", async () => {
      const { body } = signedWebhook("charge.success", chargeSuccess("COLBIOS-2026-AAAA1111", 600_000));
      await expect(handleWebhook(body, null)).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects a forged signature", async () => {
      const { body } = signedWebhook("charge.success", chargeSuccess("COLBIOS-2026-AAAA1111", 600_000));
      await expect(handleWebhook(body, "0".repeat(128))).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects a body altered after signing", async () => {
      const { reference } = await initializePayment(submission());
      const { body, signature } = signedWebhook(
        "charge.success",
        chargeSuccess(reference, fixtures.amounts.L300),
      );
      const tampered = body.replace(String(fixtures.amounts.L300), "1");

      await expect(handleWebhook(tampered, signature)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await prisma.paymentEvent.count()).toBe(0);
    });

    it("fulfils a correctly signed charge.success", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({ reference, amount: fixtures.amounts.L300, status: "success" });

      const { body, signature } = signedWebhook(
        "charge.success",
        chargeSuccess(reference, fixtures.amounts.L300),
      );
      const outcome = await handleWebhook(body, signature);

      expect(outcome.status).toBe("processed");
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { reference },
        include: { receipt: true },
      });
      expect(payment.status).toBe("SUCCESS");
      expect(payment.receipt).not.toBeNull();
    });

    it("re-verifies with the provider rather than trusting the webhook body", async () => {
      const { reference } = await initializePayment(submission());

      // The body claims success at the right amount, but Paystack itself says
      // the transaction failed. The provider wins.
      paystack.setTransaction({ reference, amount: fixtures.amounts.L300, status: "failed" });

      const { body, signature } = signedWebhook(
        "charge.success",
        chargeSuccess(reference, fixtures.amounts.L300),
      );

      await expect(handleWebhook(body, signature)).rejects.toMatchObject({
        code: "PAYMENT_NOT_SUCCESSFUL",
      });
      expect(await prisma.receipt.count()).toBe(0);
    });

    it("rejects a webhook whose verified amount does not match", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({ reference, amount: 1, status: "success" });

      const { body, signature } = signedWebhook("charge.success", chargeSuccess(reference, 1));

      await expect(handleWebhook(body, signature)).rejects.toMatchObject({
        code: "AMOUNT_MISMATCH",
      });
      expect(await prisma.receipt.count()).toBe(0);
    });

    it("ignores a duplicate delivery of the same event", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({ reference, amount: fixtures.amounts.L300, status: "success" });

      const { body, signature } = signedWebhook(
        "charge.success",
        chargeSuccess(reference, fixtures.amounts.L300),
      );

      const first = await handleWebhook(body, signature);
      const second = await handleWebhook(body, signature);
      const third = await handleWebhook(body, signature);

      expect(first.status).toBe("processed");
      expect(second.status).toBe("duplicate");
      expect(third.status).toBe("duplicate");
      expect(await prisma.receipt.count()).toBe(1);
      expect(await prisma.paymentEvent.count({ where: { source: "WEBHOOK" } })).toBe(1);
    });

    it("stays correct when the callback verifies first and the webhook arrives after", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({ reference, amount: fixtures.amounts.L300, status: "success" });

      await verifyPaymentByReference(reference);

      const { body, signature } = signedWebhook(
        "charge.success",
        chargeSuccess(reference, fixtures.amounts.L300),
      );
      const outcome = await handleWebhook(body, signature);

      expect(outcome.status).toBe("processed");
      expect(await prisma.receipt.count()).toBe(1);
      expect(await prisma.payment.count({ where: { status: "SUCCESS" } })).toBe(1);
    });

    it("stays correct when the webhook arrives before the student returns", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({ reference, amount: fixtures.amounts.L300, status: "success" });

      const { body, signature } = signedWebhook(
        "charge.success",
        chargeSuccess(reference, fixtures.amounts.L300),
      );
      await handleWebhook(body, signature);

      const result = await verifyPaymentByReference(reference);
      expect(result.state).toBe("SUCCESS");
      if (result.state === "SUCCESS") expect(result.newlyFulfilled).toBe(false);
      expect(await prisma.receipt.count()).toBe(1);
    });

    it("records a charge.failed without touching a payment that already succeeded", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({ reference, amount: fixtures.amounts.L300, status: "success" });
      await verifyPaymentByReference(reference);

      const { body, signature } = signedWebhook("charge.failed", {
        id: 999,
        reference,
        status: "failed",
        gateway_response: "Declined",
      });
      const outcome = await handleWebhook(body, signature);

      expect(outcome.status).toBe("processed");
      expect((await prisma.payment.findUniqueOrThrow({ where: { reference } })).status).toBe("SUCCESS");
    });

    it("acknowledges events it does not handle without failing", async () => {
      const { body, signature } = signedWebhook("customer.identification.failed", {
        id: 5,
        reference: "COLBIOS-2026-AAAA1111",
      });
      const outcome = await handleWebhook(body, signature);
      expect(outcome.status).toBe("ignored");
    });

    it("stores the event before processing, so a failure is diagnosable", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({ reference, amount: 1, status: "success" });

      const { body, signature } = signedWebhook("charge.success", chargeSuccess(reference, 1));
      await expect(handleWebhook(body, signature)).rejects.toThrow();

      const event = await prisma.paymentEvent.findFirstOrThrow();
      expect(event.processed).toBe(false);
      expect(event.error).toContain("amount paid does not match");
    });
  });

  describe("manual adjustments", () => {
    it("records an offline payment as clearly not a Paystack transaction", async () => {
      const { reference } = await initializePayment(submission());
      const payment = await prisma.payment.findUniqueOrThrow({ where: { reference } });

      const admin = await prisma.adminUser.create({
        data: {
          email: "finance@example.edu",
          name: "Finance Officer",
          passwordHash: "not-used-in-this-test",
          role: "FINANCE",
        },
      });

      const outcome = await recordManualAdjustment({
        paymentId: payment.id,
        reason: "Bank transfer confirmed against the college statement, teller 4821.",
        adminId: admin.id,
      });

      expect(outcome.payment.status).toBe("SUCCESS");
      expect(outcome.payment.isManualAdjustment).toBe(true);
      expect(outcome.payment.paystackTransactionId).toBeNull();
      expect(outcome.payment.channel).toBe("manual_adjustment");
      expect(outcome.payment.manualAdjustedById).toBe(admin.id);
      expect(outcome.receipt.receiptNumber).toMatch(/^COLBIOS-REC-2026-\d{6}$/);
    });

    it("refuses to adjust a payment that already completed", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({ reference, amount: fixtures.amounts.L300, status: "success" });
      await verifyPaymentByReference(reference);

      const payment = await prisma.payment.findUniqueOrThrow({ where: { reference } });
      await expect(
        recordManualAdjustment({
          paymentId: payment.id,
          reason: "Attempting to adjust a payment that is already complete.",
          adminId: "someone",
        }),
      ).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("helpers", () => {
    it("finds the fulfilled payment for a student", async () => {
      const { reference } = await initializePayment(submission());
      paystack.setTransaction({ reference, amount: fixtures.amounts.L300, status: "success" });
      await verifyPaymentByReference(reference);

      const payment = await prisma.payment.findUniqueOrThrow({ where: { reference } });
      const found = await findFulfilledPayment(
        payment.matricNormal,
        payment.sessionId,
        payment.feeId,
      );
      expect(found?.reference).toBe(reference);
    });
  });
});
