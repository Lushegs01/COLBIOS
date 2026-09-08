import { describe, expect, it } from "vitest";

import { roleHasPermission } from "@/lib/auth/guard";
import { escapeCsvValue, csvRow } from "@/lib/admin/csv";
import { compareLevels, levelLabel, parseLevel } from "@/lib/format/level";
import { redact } from "@/lib/logger";
import {
  formatReceiptNumber,
  generatePaymentReference,
  isValidReference,
  sessionYear,
} from "@/lib/payments/reference";
import {
  BLOCKING_STATUSES,
  canTransition,
  fromProviderStatus,
  isTerminal,
  assertTransition,
} from "@/lib/payments/state";
import { checkProviderTransaction, resolveChannel } from "@/lib/payments/verification";
import { computeWebhookSignature, verifyWebhookSignature } from "@/lib/paystack/signature";
import { maskMatric } from "@/lib/payments/lookup";
import { providerEventId, parseWebhookBody } from "@/lib/payments/webhook";
import { defaultTransaction } from "../helpers/paystack";

describe("level parsing", () => {
  it("accepts the shapes a student or an admin might type", () => {
    expect(parseLevel("300L")).toBe("L300");
    expect(parseLevel("300")).toBe("L300");
    expect(parseLevel("l300")).toBe("L300");
    expect(parseLevel(" 300 L ")).toBe("L300");
  });

  it("rejects levels the college does not run", () => {
    expect(parseLevel("600L")).toBeNull();
    expect(parseLevel("abc")).toBeNull();
    expect(parseLevel("")).toBeNull();
    expect(parseLevel("30")).toBeNull();
  });

  it("renders and orders levels for display", () => {
    expect(levelLabel("L100")).toBe("100L");
    expect(compareLevels("L100", "L400")).toBeLessThan(0);
  });
});

describe("payment references", () => {
  it("uses the session's starting year", () => {
    expect(generatePaymentReference("2026/2027")).toMatch(/^COLBIOS-2026-[0-9A-HJ-NP-TV-Z]{8}$/);
    expect(sessionYear("2026/2027")).toBe(2026);
  });

  it("falls back to the current year for an unexpected session name", () => {
    const year = new Date().getUTCFullYear();
    expect(sessionYear("Session One")).toBe(year);
    expect(generatePaymentReference("Session One")).toContain(`COLBIOS-${year}-`);
  });

  it("omits characters that are misread aloud", () => {
    const suffixes = Array.from({ length: 200 }, () =>
      generatePaymentReference("2026/2027").split("-")[2],
    );
    expect(suffixes.join("")).not.toMatch(/[ILOU]/);
  });

  it("does not repeat itself across many references", () => {
    const references = new Set(
      Array.from({ length: 5_000 }, () => generatePaymentReference("2026/2027")),
    );
    expect(references.size).toBe(5_000);
  });

  it("validates references strictly", () => {
    expect(isValidReference("COLBIOS-2026-7F3KQ9AB")).toBe(true);
    expect(isValidReference("COLBIOS-2026-7F3KQ9A")).toBe(false);
    expect(isValidReference("colbios-2026-7f3kq9ab")).toBe(false);
    expect(isValidReference("COLBIOS-2026-7F3KQ9AI")).toBe(false); // I is not in the alphabet
    expect(isValidReference("' OR 1=1 --")).toBe(false);
  });

  it("formats receipt numbers with a padded sequence", () => {
    expect(formatReceiptNumber(2026, 1)).toBe("COLBIOS-REC-2026-000001");
    expect(formatReceiptNumber(2026, 123_456)).toBe("COLBIOS-REC-2026-123456");
  });
});

describe("payment state machine", () => {
  it("allows only the transitions the business actually has", () => {
    expect(canTransition("PENDING", "SUCCESS")).toBe(true);
    expect(canTransition("PENDING", "FAILED")).toBe(true);
    expect(canTransition("PENDING", "ABANDONED")).toBe(true);
    expect(canTransition("SUCCESS", "REFUNDED")).toBe(true);
    expect(canTransition("SUCCESS", "REVERSED")).toBe(true);
    // A late "charge.success" after an abandoned checkout is legitimate.
    expect(canTransition("ABANDONED", "SUCCESS")).toBe(true);
    expect(canTransition("FAILED", "SUCCESS")).toBe(true);
  });

  it("never walks a payment backwards or out of a terminal state", () => {
    expect(canTransition("SUCCESS", "PENDING")).toBe(false);
    expect(canTransition("SUCCESS", "FAILED")).toBe(false);
    expect(canTransition("REFUNDED", "SUCCESS")).toBe(false);
    expect(canTransition("REVERSED", "SUCCESS")).toBe(false);
    expect(isTerminal("REFUNDED")).toBe(true);
    expect(isTerminal("PENDING")).toBe(false);
  });

  it("treats re-applying the same status as a no-op, not an error", () => {
    expect(canTransition("SUCCESS", "SUCCESS")).toBe(true);
    expect(() => assertTransition("SUCCESS", "SUCCESS")).not.toThrow();
  });

  it("throws with a readable message on an invalid transition", () => {
    expect(() => assertTransition("REFUNDED", "SUCCESS")).toThrowError(
      /cannot move from REFUNDED to SUCCESS/,
    );
  });

  it("maps provider statuses, defaulting unknown ones to pending", () => {
    expect(fromProviderStatus("success")).toBe("SUCCESS");
    expect(fromProviderStatus("FAILED")).toBe("FAILED");
    expect(fromProviderStatus("ongoing")).toBe("PENDING");
    expect(fromProviderStatus("something-new")).toBe("PENDING");
  });

  it("blocks a new payment only when one has already succeeded", () => {
    expect(BLOCKING_STATUSES).toEqual(["SUCCESS"]);
  });
});

describe("provider transaction checks", () => {
  const expected = { reference: "COLBIOS-2026-7F3KQ9AB", amount: 600_000, currency: "NGN" };

  it("accepts a transaction that matches in every respect", () => {
    const result = checkProviderTransaction(expected, {
      ...defaultTransaction(expected.reference),
      amount: 600_000,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an amount that does not match exactly", () => {
    for (const amount of [599_999, 600_001, 1, 0, 60_000_000]) {
      const result = checkProviderTransaction(expected, {
        ...defaultTransaction(expected.reference),
        amount,
      });
      expect(result.ok, `amount ${amount}`).toBe(false);
      if (!result.ok) expect(result.reason).toBe("AMOUNT_MISMATCH");
    }
  });

  it("rejects a mismatched currency", () => {
    const result = checkProviderTransaction(expected, {
      ...defaultTransaction(expected.reference),
      amount: 600_000,
      currency: "USD",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("CURRENCY_MISMATCH");
  });

  it("rejects a transaction for a different reference", () => {
    const result = checkProviderTransaction(expected, {
      ...defaultTransaction("COLBIOS-2026-ZZZZZZZZ"),
      amount: 600_000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("REFERENCE_MISMATCH");
  });

  it("rejects any status other than success", () => {
    for (const status of ["failed", "abandoned", "ongoing", "pending", ""]) {
      const result = checkProviderTransaction(expected, {
        ...defaultTransaction(expected.reference),
        amount: 600_000,
        status,
      });
      expect(result.ok, status).toBe(false);
      if (!result.ok) expect(result.reason).toBe("NOT_SUCCESSFUL");
    }
  });

  it("rejects a missing transaction rather than assuming success", () => {
    expect(checkProviderTransaction(expected, null).ok).toBe(false);
    expect(checkProviderTransaction(expected, undefined).ok).toBe(false);
  });

  it("rejects a non-integer amount instead of coercing it", () => {
    const result = checkProviderTransaction(expected, {
      ...defaultTransaction(expected.reference),
      amount: 600_000.4,
    });
    expect(result.ok).toBe(false);
  });

  it("reads the channel from either place Paystack reports it", () => {
    expect(resolveChannel({ ...defaultTransaction("r"), channel: "bank" })).toBe("bank");
    expect(
      resolveChannel({
        ...defaultTransaction("r"),
        channel: null,
        authorization: { channel: "ussd" },
      }),
    ).toBe("ussd");
  });
});

describe("webhook signatures", () => {
  const secret = "sk_test_example_key";
  const body = JSON.stringify({ event: "charge.success", data: { reference: "COLBIOS-2026-AAAA1111" } });

  it("accepts a correctly signed body", () => {
    const signature = computeWebhookSignature(body, secret);
    expect(verifyWebhookSignature(body, signature, secret)).toBe(true);
    expect(verifyWebhookSignature(body, signature.toUpperCase(), secret)).toBe(true);
  });

  it("rejects a body that has been altered by even one character", () => {
    const signature = computeWebhookSignature(body, secret);
    const tampered = body.replace("charge.success", "charge.succes5");
    expect(verifyWebhookSignature(tampered, signature, secret)).toBe(false);
  });

  it("rejects a signature made with a different key", () => {
    expect(verifyWebhookSignature(body, computeWebhookSignature(body, "other"), secret)).toBe(false);
  });

  it("rejects missing, empty and malformed signatures", () => {
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyWebhookSignature(body, undefined, secret)).toBe(false);
    expect(verifyWebhookSignature(body, "", secret)).toBe(false);
    expect(verifyWebhookSignature(body, "not-a-signature", secret)).toBe(false);
  });
});

describe("webhook parsing", () => {
  it("derives a stable event id from the event type and transaction id", () => {
    const event = { event: "charge.success", data: { id: 42, reference: "COLBIOS-2026-AAAA1111" } };
    expect(providerEventId(event)).toBe("charge.success:42");
    // The same delivery, replayed, produces the same id — that is what makes
    // the unique constraint work as an idempotency key.
    expect(providerEventId(structuredClone(event))).toBe(providerEventId(event));
  });

  it("falls back to the reference when no transaction id is present", () => {
    expect(providerEventId({ event: "charge.failed", data: { reference: "COLBIOS-2026-AAAA1111" } })).toBe(
      "charge.failed:COLBIOS-2026-AAAA1111",
    );
  });

  it("returns null for bodies that are not events", () => {
    expect(parseWebhookBody("not json")).toBeNull();
    expect(parseWebhookBody("null")).toBeNull();
    expect(parseWebhookBody('{"event":"charge.success"}')).toBeNull();
    expect(parseWebhookBody('{"data":{}}')).toBeNull();
  });
});

describe("role permissions", () => {
  it("keeps fee and refund powers with finance and super administrators", () => {
    expect(roleHasPermission("FINANCE", "fees:write")).toBe(true);
    expect(roleHasPermission("SUPER_ADMIN", "fees:write")).toBe(true);
    expect(roleHasPermission("ADMIN", "fees:write")).toBe(false);
    expect(roleHasPermission("ADMIN", "payments:adjust")).toBe(false);
  });

  it("restricts account management to super administrators", () => {
    expect(roleHasPermission("SUPER_ADMIN", "admins:manage")).toBe(true);
    expect(roleHasPermission("ADMIN", "admins:manage")).toBe(false);
    expect(roleHasPermission("FINANCE", "admins:manage")).toBe(false);
  });

  it("lets every role read payments", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN", "FINANCE"] as const) {
      expect(roleHasPermission(role, "payments:read")).toBe(true);
    }
  });
});

describe("CSV safety", () => {
  it("quotes values containing separators", () => {
    expect(escapeCsvValue("Doe, John")).toBe('"Doe, John"');
    expect(escapeCsvValue('He said "hi"')).toBe('"He said ""hi"""');
    expect(escapeCsvValue("line\nbreak")).toBe('"line\nbreak"');
  });

  it("neutralises spreadsheet formula injection", () => {
    // A name like =HYPERLINK(...) must not execute when finance opens the file.
    expect(escapeCsvValue("=1+1")).toBe("'=1+1");
    expect(escapeCsvValue("+1234")).toBe("'+1234");
    expect(escapeCsvValue("-1234")).toBe("'-1234");
    expect(escapeCsvValue("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("writes CRLF rows as spreadsheets expect", () => {
    expect(csvRow(["a", "b"])).toBe("a,b\r\n");
  });

  it("renders empty values for null and undefined", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
  });
});

describe("log redaction", () => {
  it("removes values under sensitive keys", () => {
    const output = redact({
      password: "hunter2",
      authorization: "Bearer abc",
      signature: "deadbeef",
      reference: "COLBIOS-2026-AAAA1111",
    });
    expect(output.password).toBe("[redacted]");
    expect(output.authorization).toBe("[redacted]");
    expect(output.signature).toBe("[redacted]");
    expect(output.reference).toBe("COLBIOS-2026-AAAA1111");
  });

  it("removes secrets that appear inside otherwise innocent strings", () => {
    const output = redact({
      message: "failed with key sk_test_abc123 and db postgres://user:pw@host/db",
    });
    expect(String(output.message)).not.toContain("sk_test_abc123");
    expect(String(output.message)).not.toContain("user:pw");
  });

  it("redacts recursively through nested objects and arrays", () => {
    const output = redact({ nested: { apiKey: "secret", list: ["sk_live_zzz"] } });
    expect(JSON.stringify(output)).not.toContain("secret");
    expect(JSON.stringify(output)).not.toContain("sk_live_zzz");
  });
});

describe("matric masking", () => {
  it("hides part of the number on the public verification page", () => {
    expect(maskMatric("2023/123456")).toBe("2023/12••56");
    expect(maskMatric("ABC12")).toBe("ABC12");
  });
});
