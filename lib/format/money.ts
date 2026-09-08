/**
 * Money handling.
 *
 * Amounts are integers in the currency's minor unit (kobo for NGN) everywhere:
 * in the database, in this codebase, and on the wire to Paystack. Floating
 * point never touches a monetary value — ₦5,000.10 is 500010, not 5000.1.
 */

export const SUPPORTED_CURRENCIES = ["NGN"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_SYMBOL: Record<Currency, string> = { NGN: "₦" };

/** Largest amount we will ever accept for a single dues payment: ₦1,000,000. */
export const MAX_AMOUNT_MINOR = 100_000_000;
/** Smallest chargeable amount: ₦100 (Paystack's practical floor for cards). */
export const MIN_AMOUNT_MINOR = 10_000;

export function isSupportedCurrency(value: string): value is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

/**
 * Convert a major-unit amount (what an admin types, e.g. "5000" or "5000.50")
 * into minor units. Parsing is done on the *string* to avoid float drift.
 * Returns null when the input is not a well-formed amount.
 */
export function majorToMinor(input: string | number): number | null {
  const raw = typeof input === "number" ? input.toString() : input.trim();
  if (raw === "") return null;

  const normalised = raw.replace(/,/g, "").replace(/^₦\s*/, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(normalised)) return null;

  const [whole, fraction = ""] = normalised.split(".");
  const paddedFraction = (fraction + "00").slice(0, 2);
  const minor = Number(whole) * 100 + Number(paddedFraction);

  return Number.isSafeInteger(minor) ? minor : null;
}

/** Minor units back to a plain major-unit string, e.g. 500050 -> "5000.50". */
export function minorToMajorString(minor: number): string {
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const whole = Math.floor(abs / 100);
  const fraction = (abs % 100).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/**
 * Display formatting, e.g. 500000 -> "₦5,000". Whole amounts drop the decimals
 * because that is how Nigerian fee amounts are read aloud and printed.
 */
export function formatMoney(minor: number, currency: string = "NGN"): string {
  const symbol = isSupportedCurrency(currency) ? CURRENCY_SYMBOL[currency] : `${currency} `;
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const whole = Math.floor(abs / 100);
  const kobo = abs % 100;

  const grouped = whole.toLocaleString("en-NG");
  const tail = kobo === 0 ? "" : `.${kobo.toString().padStart(2, "0")}`;

  return `${negative ? "-" : ""}${symbol}${grouped}${tail}`;
}

/** Guard used before any amount is written to the database or sent to Paystack. */
export function isValidChargeAmount(minor: number): boolean {
  return (
    Number.isSafeInteger(minor) &&
    minor >= MIN_AMOUNT_MINOR &&
    minor <= MAX_AMOUNT_MINOR
  );
}
