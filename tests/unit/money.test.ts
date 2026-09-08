import { describe, expect, it } from "vitest";

import {
  formatMoney,
  isValidChargeAmount,
  majorToMinor,
  minorToMajorString,
} from "@/lib/format/money";

/**
 * Money conversion is the one place a rounding bug turns into a student being
 * charged the wrong amount, so every boundary here is pinned.
 */
describe("majorToMinor", () => {
  it("converts whole naira to kobo", () => {
    expect(majorToMinor("5000")).toBe(500_000);
    expect(majorToMinor(5000)).toBe(500_000);
  });

  it("converts kobo without floating-point drift", () => {
    // 0.1 + 0.2 style errors are exactly what this avoids: the parse is
    // string-based, so 5000.10 is 500010 kobo, never 500009.999…
    expect(majorToMinor("5000.10")).toBe(500_010);
    expect(majorToMinor("0.29")).toBe(29);
    expect(majorToMinor("1234.56")).toBe(123_456);
  });

  it("pads a single decimal place", () => {
    expect(majorToMinor("100.5")).toBe(10_050);
  });

  it("accepts formatted input a human would type", () => {
    expect(majorToMinor(" ₦5,000 ")).toBe(500_000);
    expect(majorToMinor("5,500.50")).toBe(550_050);
  });

  it("rejects anything that is not a well-formed amount", () => {
    for (const input of ["", "abc", "5000.123", "-100", "1e5", "5 000", "5000..0", "."]) {
      expect(majorToMinor(input), input).toBeNull();
    }
  });
});

describe("minorToMajorString", () => {
  it("round-trips with majorToMinor", () => {
    for (const value of ["5000.00", "0.01", "999999.99", "1.50"]) {
      const minor = majorToMinor(value);
      expect(minor).not.toBeNull();
      expect(minorToMajorString(minor as number)).toBe(value);
    }
  });
});

describe("formatMoney", () => {
  it("drops decimals for whole amounts", () => {
    expect(formatMoney(500_000)).toBe("₦5,000");
    expect(formatMoney(0)).toBe("₦0");
  });

  it("keeps kobo when present", () => {
    expect(formatMoney(500_050)).toBe("₦5,000.50");
    expect(formatMoney(1)).toBe("₦0.01");
  });

  it("falls back to the raw code for an unknown currency", () => {
    expect(formatMoney(500_000, "USD")).toBe("USD 5,000");
  });
});

describe("isValidChargeAmount", () => {
  it("accepts amounts inside the configured bounds", () => {
    expect(isValidChargeAmount(10_000)).toBe(true);
    expect(isValidChargeAmount(600_000)).toBe(true);
    expect(isValidChargeAmount(100_000_000)).toBe(true);
  });

  it("rejects amounts that should never reach Paystack", () => {
    expect(isValidChargeAmount(0)).toBe(false);
    expect(isValidChargeAmount(9_999)).toBe(false);
    expect(isValidChargeAmount(100_000_001)).toBe(false);
    expect(isValidChargeAmount(-500_000)).toBe(false);
    expect(isValidChargeAmount(500_000.5)).toBe(false);
    expect(isValidChargeAmount(Number.NaN)).toBe(false);
  });
});
