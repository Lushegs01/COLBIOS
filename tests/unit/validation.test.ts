import { describe, expect, it } from "vitest";

import {
  adminPasswordSchema,
  feeAmountSchema,
  fullNameSchema,
  initializePaymentSchema,
  manualAdjustmentSchema,
  matricNumberSchema,
  normaliseMatric,
  referenceSchema,
  sessionCreateSchema,
} from "@/lib/validation/schemas";

describe("student identity validation", () => {
  it("tidies whitespace without altering the name itself", () => {
    expect(fullNameSchema.parse("  John   Doe  ")).toBe("John Doe");
    expect(fullNameSchema.parse("Ngozi Chukwuemeka-Obi")).toBe("Ngozi Chukwuemeka-Obi");
    expect(fullNameSchema.parse("N'Diaye O'Brien")).toBe("N'Diaye O'Brien");
  });

  it("requires a full name, not a single word", () => {
    expect(fullNameSchema.safeParse("John").success).toBe(false);
    expect(fullNameSchema.safeParse("").success).toBe(false);
    expect(fullNameSchema.safeParse("   ").success).toBe(false);
  });

  it("accepts genuinely short names rather than assuming a minimum length", () => {
    // Short given names and surnames are common; the rule is "two parts",
    // not "long enough to look Western".
    expect(fullNameSchema.safeParse("Ng Li").success).toBe(true);
    expect(fullNameSchema.safeParse("Ade Ola").success).toBe(true);
  });

  it("rejects names carrying markup or scripts", () => {
    expect(fullNameSchema.safeParse("<script>alert(1)</script>").success).toBe(false);
    expect(fullNameSchema.safeParse("John <b>Doe</b>").success).toBe(false);
    expect(fullNameSchema.safeParse("a".repeat(200)).success).toBe(false);
  });

  it("preserves the matric number exactly as typed", () => {
    // Only surrounding whitespace goes; the identifier itself is untouched.
    expect(matricNumberSchema.parse(" 2023/123456 ")).toBe("2023/123456");
    expect(matricNumberSchema.parse("20231234ab")).toBe("20231234ab");
  });

  it("rejects matric numbers with characters no matric number has", () => {
    for (const value of ["2023 123456", "2023;DROP", "'; --", "<img>", "", "ab"]) {
      expect(matricNumberSchema.safeParse(value).success, value).toBe(false);
    }
  });

  it("normalises only for matching purposes", () => {
    expect(normaliseMatric("2023/123456")).toBe("2023/123456".toUpperCase());
    expect(normaliseMatric(" 2023 / 123456 ")).toBe("2023/123456");
    expect(normaliseMatric("abc123")).toBe("ABC123");
  });
});

describe("payment initialization payload", () => {
  const valid = {
    fullName: "John Doe",
    matricNumber: "2023/123456",
    email: "John.Doe@Example.com ",
    departmentId: "clx1234567890abcdef",
    level: "300L",
  };

  it("accepts a well-formed submission and normalises the email", () => {
    const parsed = initializePaymentSchema.parse(valid);
    expect(parsed.email).toBe("john.doe@example.com");
    expect(parsed.level).toBe("L300");
  });

  it("ignores an amount the client tries to smuggle in", () => {
    // The schema has no `amount` field at all, so a client-supplied one is
    // dropped before it can reach any code that could act on it.
    const parsed = initializePaymentSchema.parse({ ...valid, amount: 1, feeId: "x" });
    expect(parsed).not.toHaveProperty("amount");
    expect(parsed).not.toHaveProperty("feeId");
  });

  it("rejects an invalid email", () => {
    expect(initializePaymentSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a level the college does not run", () => {
    expect(initializePaymentSchema.safeParse({ ...valid, level: "600L" }).success).toBe(false);
  });

  it("reports every invalid field at once", () => {
    const result = initializePaymentSchema.safeParse({
      fullName: "x",
      matricNumber: "!!",
      email: "nope",
      departmentId: "",
      level: "999",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = new Set(result.error.issues.map((issue) => issue.path[0]));
      expect(fields).toContain("fullName");
      expect(fields).toContain("email");
      expect(fields).toContain("level");
    }
  });
});

describe("reference validation", () => {
  it("upper-cases and validates the shape", () => {
    expect(referenceSchema.parse(" colbios-2026-7f3kq9ab ")).toBe("COLBIOS-2026-7F3KQ9AB");
  });

  it("rejects references that could be probing attempts", () => {
    for (const value of ["", "COLBIOS-2026-", "../../etc/passwd", "%00", "COLBIOS-2026-7F3KQ9A"]) {
      expect(referenceSchema.safeParse(value).success, value).toBe(false);
    }
  });
});

describe("fee amount validation", () => {
  it("converts naira input to kobo", () => {
    expect(feeAmountSchema.parse("5000")).toBe(500_000);
    expect(feeAmountSchema.parse("5,500.50")).toBe(550_050);
  });

  it("rejects amounts outside the allowed range", () => {
    expect(feeAmountSchema.safeParse("0").success).toBe(false);
    expect(feeAmountSchema.safeParse("50").success).toBe(false);
    expect(feeAmountSchema.safeParse("2000000").success).toBe(false);
    expect(feeAmountSchema.safeParse("-500").success).toBe(false);
    expect(feeAmountSchema.safeParse("abc").success).toBe(false);
  });
});

describe("session naming", () => {
  it("requires consecutive years", () => {
    expect(sessionCreateSchema.safeParse({ name: "2026/2027" }).success).toBe(true);
    expect(sessionCreateSchema.safeParse({ name: "2026/2028" }).success).toBe(false);
    expect(sessionCreateSchema.safeParse({ name: "26/27" }).success).toBe(false);
  });
});

describe("administrator password policy", () => {
  it("accepts a strong password", () => {
    expect(adminPasswordSchema.safeParse("Correct-Horse-9!").success).toBe(true);
  });

  it("rejects weak or predictable passwords", () => {
    for (const value of [
      "short1!A",
      "alllowercase1!",
      "ALLUPPERCASE1!",
      "NoNumbersHere!",
      "NoSymbols1234",
      "Password123!",
      "colbios2026!A",
    ]) {
      expect(adminPasswordSchema.safeParse(value).success, value).toBe(false);
    }
  });
});

describe("manual adjustment guard rails", () => {
  const base = { paymentId: "clx1234567890abcdef", confirmation: "CONFIRM" };

  it("requires a substantial reason and an explicit confirmation", () => {
    expect(
      manualAdjustmentSchema.safeParse({
        ...base,
        reason: "Bank transfer confirmed against the college statement, teller 4821.",
      }).success,
    ).toBe(true);
  });

  it("rejects a token reason", () => {
    expect(manualAdjustmentSchema.safeParse({ ...base, reason: "paid" }).success).toBe(false);
  });

  it("rejects a missing confirmation", () => {
    const result = manualAdjustmentSchema.safeParse({
      paymentId: base.paymentId,
      reason: "Bank transfer confirmed against the college statement, teller 4821.",
      confirmation: "yes",
    });
    expect(result.success).toBe(false);
  });
});
