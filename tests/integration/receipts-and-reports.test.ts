import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDashboardStats, getLevelBreakdown } from "@/lib/admin/analytics";
import { csvDocument } from "@/lib/admin/csv";
import { findPayments } from "@/lib/admin/payments-query";
import { prisma } from "@/lib/db/prisma";
import { findPublicPayment, toVerificationView } from "@/lib/payments/lookup";
import { initializePayment, verifyPaymentByReference } from "@/lib/payments/service";
import { PDFDocument } from "pdf-lib";

import { buildReceiptPdf, pdfSafe, qrDataUrl } from "@/lib/receipts/pdf";
import { RATE_LIMITS, checkRateLimit } from "@/lib/rate-limit/limiter";
import { paymentFilterSchema } from "@/lib/validation/schemas";

import { resetDatabase, seedFixtures, studentSubmission, type Fixtures } from "../helpers/db";
import { stubPaystack, type PaystackStub } from "../helpers/paystack";

describe("receipts, reporting and rate limits", () => {
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

  async function payFor(matric: string, level: "L100" | "L300" | "L500", id: number) {
    const { reference } = await initializePayment({
      ...studentSubmission({ matricNumber: matric, matricNormal: matric }),
      level,
      email: `${matric.replace(/\W/g, "")}@example.com`,
      departmentId: fixtures.department.id,
    });
    paystack.setTransaction({
      reference,
      id,
      amount: fixtures.amounts[level],
      status: "success",
    });
    await verifyPaymentByReference(reference);
    return reference;
  }

  describe("receipt documents", () => {
    it("renders a PDF for a verified payment", async () => {
      const reference = await payFor("2023/000001", "L300", 800_000_001);
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { reference },
        include: { receipt: true },
      });

      const pdf = await buildReceiptPdf(payment, payment.receipt!);
      const bytes = Buffer.from(pdf);

      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      expect(bytes.length).toBeGreaterThan(2_000);

      // Re-open the document: the metadata carries the receipt number, so a
      // saved file is identifiable without reading the page.
      const reopened = await PDFDocument.load(pdf);
      expect(reopened.getTitle()).toContain(payment.receipt!.receiptNumber);
      expect(reopened.getPageCount()).toBe(1);
    });

    it("renders the naira sign and Yoruba names without mangling them", async () => {
      // A receipt built on the PDF standard fonts would throw on ₦ and on the
      // dot-below characters in this name. Both must survive.
      const name = "Ọlásùnkànmí Adéṣínà";
      expect(pdfSafe(name)).toBe(name);
      expect(pdfSafe("₦5,000")).toBe("₦5,000");

      const reference = await payFor("2023/000009", "L300", 800_000_009);
      await prisma.payment.update({ where: { reference }, data: { fullName: name } });

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { reference },
        include: { receipt: true },
      });

      const pdf = await buildReceiptPdf(payment, payment.receipt!);
      expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    });

    it("falls back gracefully for characters no embedded font covers", () => {
      // Nothing crashes, and Latin text around the unsupported run survives.
      expect(pdfSafe("Wei 伟 Chen")).toBe("Wei ? Chen");
      expect(pdfSafe("tab\tseparated")).toBe("tab separated");
    });

    it("builds a QR code pointing at the public verification page", async () => {
      const dataUrl = await qrDataUrl("http://localhost:3000/verify/COLBIOS-2026-7F3KQ9AB");
      expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
      expect(dataUrl.length).toBeGreaterThan(500);
    });

    it("exposes only public fields on the verification view", async () => {
      const reference = await payFor("2023/000002", "L300", 800_000_002);
      const payment = await findPublicPayment(reference);
      expect(payment).not.toBeNull();

      const view = toVerificationView(payment!);
      const serialised = JSON.stringify(view);

      expect(view.verified).toBe(true);
      expect(view.maskedMatric).toContain("••");
      // No email, no ids, no provider data.
      expect(serialised).not.toContain("@example.com");
      expect(serialised).not.toContain(payment!.email);
      expect(view).not.toHaveProperty("id");
      expect(view).not.toHaveProperty("paystackTransactionId");
      expect(view).not.toHaveProperty("channel");
    });

    it("does not mark an unverified payment as verified", async () => {
      const { reference } = await initializePayment({
        ...studentSubmission(),
        departmentId: fixtures.department.id,
      });

      const payment = await findPublicPayment(reference);
      const view = toVerificationView(payment!);

      expect(view.verified).toBe(false);
      expect(view.status).toBe("PENDING");
      expect(view.receiptNumber).toBeNull();
    });
  });

  describe("reporting", () => {
    beforeEach(async () => {
      await payFor("2023/000010", "L100", 810_000_001);
      await payFor("2023/000011", "L300", 810_000_002);
      await payFor("2023/000012", "L500", 810_000_003);
      // One student who started but never completed.
      await initializePayment({
        ...studentSubmission({ matricNumber: "2023/000013", matricNormal: "2023/000013" }),
        email: "unpaid@example.com",
        departmentId: fixtures.department.id,
      });
    });

    it("totals collected revenue from verified payments only", async () => {
      const stats = await getDashboardStats(fixtures.session.id);

      expect(stats.totalCollectedMinor).toBe(
        fixtures.amounts.L100 + fixtures.amounts.L300 + fixtures.amounts.L500,
      );
      expect(stats.byStatus.SUCCESS).toBe(3);
      expect(stats.byStatus.PENDING).toBe(1);
      expect(stats.paidStudents).toBe(3);
      expect(stats.outstandingStudents).toBe(1);
    });

    it("counts expected dues per student at their own level", async () => {
      const stats = await getDashboardStats(fixtures.session.id);
      expect(stats.totalExpectedMinor).toBe(
        fixtures.amounts.L100 +
          fixtures.amounts.L300 * 2 + // the unpaid student is at 300L
          fixtures.amounts.L500,
      );
    });

    it("breaks collections down by level", async () => {
      const levels = await getLevelBreakdown(fixtures.session.id);
      const byKey = Object.fromEntries(levels.map((row) => [row.key, row]));

      expect(byKey.L100.amountMinor).toBe(fixtures.amounts.L100);
      expect(byKey.L300.amountMinor).toBe(fixtures.amounts.L300);
      expect(byKey.L500.amountMinor).toBe(fixtures.amounts.L500);
      expect(byKey.L200).toBeUndefined();
    });

    it("searches payments by reference, matric number and name", async () => {
      const reference = await payFor("2023/777777", "L300", 810_000_004);

      const byReference = await findPayments(paymentFilterSchema.parse({ q: reference }));
      expect(byReference.rows).toHaveLength(1);

      const byMatric = await findPayments(paymentFilterSchema.parse({ q: "2023/777777" }));
      expect(byMatric.rows[0]?.reference).toBe(reference);

      // The normalised column means spacing does not matter.
      const spaced = await findPayments(paymentFilterSchema.parse({ q: " 2023/777777 " }));
      expect(spaced.rows[0]?.reference).toBe(reference);

      const byName = await findPayments(paymentFilterSchema.parse({ q: "john" }));
      expect(byName.total).toBeGreaterThan(0);
    });

    it("filters by status and level", async () => {
      const pending = await findPayments(paymentFilterSchema.parse({ status: "PENDING" }));
      expect(pending.rows.every((row) => row.status === "PENDING")).toBe(true);

      const level = await findPayments(paymentFilterSchema.parse({ level: "L100" }));
      expect(level.rows.every((row) => row.level === "L100")).toBe(true);
    });

    it("paginates rather than returning everything", async () => {
      const page = await findPayments(paymentFilterSchema.parse({ page: 1 }), { take: 2 });
      expect(page.rows).toHaveLength(2);
      expect(page.total).toBeGreaterThan(2);
      expect(page.pages).toBeGreaterThan(1);
    });

    it("produces a CSV whose rows line up with the payments", async () => {
      const { rows } = await findPayments(paymentFilterSchema.parse({ status: "SUCCESS" }));
      const csv = csvDocument(
        ["Reference", "Student", "Amount"],
        rows.map((row) => [row.reference, row.fullName, row.amount]),
      );

      const lines = csv.trim().split("\r\n");
      expect(lines[0]).toBe("Reference,Student,Amount");
      expect(lines).toHaveLength(rows.length + 1);
      for (const row of rows) expect(csv).toContain(row.reference);
    });
  });

  describe("rate limiting", () => {
    it("allows requests up to the limit and refuses the rest", async () => {
      const rule = { bucket: "test:bucket", limit: 3, windowMs: 60_000 };
      const identifier = "test-client-1";

      const results = [];
      for (let index = 0; index < 5; index += 1) {
        results.push(await checkRateLimit(rule, identifier));
      }

      expect(results.map((result) => result.allowed)).toEqual([true, true, true, false, false]);
      expect(results[2].remaining).toBe(0);
      expect(results[4].retryAfterSeconds).toBeGreaterThan(0);
    });

    it("counts each client separately", async () => {
      const rule = { bucket: "test:isolated", limit: 1, windowMs: 60_000 };

      expect((await checkRateLimit(rule, "client-a")).allowed).toBe(true);
      expect((await checkRateLimit(rule, "client-b")).allowed).toBe(true);
      expect((await checkRateLimit(rule, "client-a")).allowed).toBe(false);
    });

    it("stores a hashed identifier, never the raw address", async () => {
      await checkRateLimit({ bucket: "test:privacy", limit: 5, windowMs: 60_000 }, "203.0.113.42");

      const rows = await prisma.rateLimitBucket.findMany({ where: { bucket: "test:privacy" } });
      expect(rows).toHaveLength(1);
      expect(rows[0].id).not.toContain("203.0.113.42");
    });

    it("applies a tighter limit to payment initialization than to lookups", () => {
      expect(RATE_LIMITS.paymentInitialize.limit).toBeLessThan(RATE_LIMITS.publicLookup.limit);
    });

    it("survives a database failure by allowing the request", async () => {
      // A rate-limiter outage must not take payments down with it.
      const rule = { bucket: "test:degraded", limit: 1, windowMs: 60_000 };
      const original = prisma.$queryRaw;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).$queryRaw = async () => {
        throw new Error("connection lost");
      };

      try {
        const result = await checkRateLimit(rule, "degraded-client");
        expect(result.allowed).toBe(true);
      } finally {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prisma as any).$queryRaw = original;
      }
    });
  });
});
