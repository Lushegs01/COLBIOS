import { z } from "zod";

import { LEVEL_CODES, parseLevel, type LevelCode } from "@/lib/format/level";
import { majorToMinor, isValidChargeAmount, SUPPORTED_CURRENCIES } from "@/lib/format/money";

/**
 * Every value that enters the system from outside — a student form, an admin
 * form, a URL parameter — is parsed by one of these schemas first.
 *
 * Normalisation rules follow one principle: whitespace and casing may be
 * cleaned up, but identity information is never silently rewritten. The matric
 * number a student typed is preserved verbatim on the payment record; a
 * separate normalised copy exists purely for matching.
 */

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_MATRIC = 40;

/** Collapse runs of whitespace and trim. Does not change characters. */
const tidy = (value: string) => value.replace(/\s+/g, " ").trim();

export const fullNameSchema = z
  .string({ error: "Enter your full name." })
  .transform(tidy)
  .pipe(
    z
      .string()
      .min(3, "Enter your full name as it appears on your student record.")
      .max(MAX_NAME, "That name is too long.")
      .regex(
        /^[\p{L}][\p{L}\p{M}'’.\- ]*$/u,
        "Use letters, spaces, hyphens and apostrophes only.",
      )
      .refine((v) => v.includes(" "), "Enter both your first and last name."),
  );

/**
 * Matric numbers at FUNAAB look like 2023/123456, but formats change over the
 * years, so the rule is deliberately permissive on shape and strict on
 * character set: digits, letters, slashes and hyphens.
 */
export const matricNumberSchema = z
  .string({ error: "Enter your matric number." })
  .transform((v) => v.trim())
  .pipe(
    z
      .string()
      .min(4, "Enter a valid matric number.")
      .max(MAX_MATRIC, "That matric number is too long.")
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9/\-]*[A-Za-z0-9]$/,
        "Matric numbers may only contain letters, numbers, slashes and hyphens.",
      ),
  );

/** Matching form: uppercase, no spaces. Never shown back to the student. */
export function normaliseMatric(matric: string): string {
  return matric.replace(/\s+/g, "").toUpperCase();
}

export const emailSchema = z
  .string({ error: "Enter your email address." })
  .transform((v) => v.trim().toLowerCase())
  .pipe(
    z
      .email("Enter a valid email address so we can send your receipt.")
      .max(MAX_EMAIL, "That email address is too long."),
  );

export const levelSchema = z
  .string({ error: "Select your level." })
  .transform((v) => parseLevel(v))
  .refine((v): v is LevelCode => v !== null, "Select a valid level.");

export const cuidSchema = z
  .string()
  .min(8, "Invalid identifier.")
  .max(64, "Invalid identifier.")
  .regex(/^[a-z0-9]+$/i, "Invalid identifier.");

/** COLBIOS-2026-7F3KQ9AB */
export const referenceSchema = z
  .string({ error: "Enter a payment reference." })
  .transform((v) => v.trim().toUpperCase())
  .pipe(
    z
      .string()
      .min(10, "That payment reference is not valid.")
      .max(64, "That payment reference is not valid.")
      .regex(/^COLBIOS-\d{4}-[0-9A-HJ-NP-TV-Z]{8}$/, "That payment reference is not valid."),
  );

export const receiptNumberSchema = z
  .string()
  .transform((v) => v.trim().toUpperCase())
  .pipe(z.string().regex(/^COLBIOS-REC-\d{4}-\d{6}$/, "That receipt number is not valid."));

// ---------------------------------------------------------------------------
// Public payment flow
// ---------------------------------------------------------------------------

/**
 * What the student's browser is allowed to send. Note what is absent: no
 * amount, no fee id, no session id. The server derives all of those.
 */
export const paymentQuoteSchema = z.object({
  fullName: fullNameSchema,
  matricNumber: matricNumberSchema,
  email: emailSchema,
  departmentId: cuidSchema,
  level: levelSchema,
});
export type PaymentQuoteInput = z.infer<typeof paymentQuoteSchema>;

export const initializePaymentSchema = paymentQuoteSchema;
export type InitializePaymentInput = z.infer<typeof initializePaymentSchema>;

export const verifyPaymentSchema = z.object({ reference: referenceSchema });

// ---------------------------------------------------------------------------
// Admin forms
// ---------------------------------------------------------------------------

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(200),
});

/**
 * Password policy for administrators. Deliberately strict: these accounts can
 * change what every student is charged.
 */
export const adminPasswordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(200, "That password is too long.")
  .refine((v) => /[a-z]/.test(v), "Include a lowercase letter.")
  .refine((v) => /[A-Z]/.test(v), "Include an uppercase letter.")
  .refine((v) => /\d/.test(v), "Include a number.")
  .refine((v) => /[^A-Za-z0-9]/.test(v), "Include a symbol.")
  .refine(
    (v) => !/^(password|passw0rd|admin|colbios|letmein|welcome|qwerty|123456)/i.test(v),
    "That password is too easy to guess.",
  );

export const sessionCreateSchema = z.object({
  name: z
    .string()
    .transform(tidy)
    .pipe(
      z
        .string()
        .regex(/^\d{4}\/\d{4}$/, "Use the format 2026/2027.")
        .refine((v) => {
          const [from, to] = v.split("/").map(Number);
          return to === from + 1;
        }, "The second year must follow the first, e.g. 2026/2027."),
    ),
  startsAt: z.iso.date().optional().or(z.literal("")),
  endsAt: z.iso.date().optional().or(z.literal("")),
});

export const departmentCreateSchema = z.object({
  name: z
    .string()
    .transform(tidy)
    .pipe(z.string().min(2, "Enter a department name.").max(80, "That name is too long.")),
  code: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .pipe(
      z
        .string()
        .min(2, "Enter a department code.")
        .max(12, "Codes are at most 12 characters.")
        .regex(/^[A-Z0-9-]+$/, "Use letters, numbers and hyphens only."),
    ),
});

export const departmentUpdateSchema = departmentCreateSchema.extend({
  id: cuidSchema,
  active: z.boolean(),
});

/**
 * Fee amounts are entered by admins in naira and converted here, once, to
 * kobo. No other code path turns a human-typed amount into a stored amount.
 */
export const feeAmountSchema = z
  .string({ error: "Enter an amount." })
  .transform((v) => majorToMinor(v))
  .refine((v): v is number => v !== null, "Enter a valid amount, e.g. 5000.")
  .refine(
    (v) => isValidChargeAmount(v as number),
    "Amounts must be between ₦100 and ₦1,000,000.",
  );

export const feeCreateSchema = z.object({
  sessionId: cuidSchema,
  level: z.enum(LEVEL_CODES),
  name: z
    .string()
    .transform(tidy)
    .pipe(z.string().min(3, "Enter a fee name.").max(80, "That name is too long.")),
  amount: feeAmountSchema,
  currency: z.enum(SUPPORTED_CURRENCIES).default("NGN"),
});

export const feeUpdateSchema = z.object({
  id: cuidSchema,
  name: z
    .string()
    .transform(tidy)
    .pipe(z.string().min(3, "Enter a fee name.").max(80, "That name is too long.")),
  amount: feeAmountSchema,
});

export const feeToggleSchema = z.object({ id: cuidSchema, active: z.boolean() });

export const manualAdjustmentSchema = z.object({
  paymentId: cuidSchema,
  /** Long enough that "ok" or "fixed" cannot be recorded as a justification. */
  reason: z
    .string()
    .transform(tidy)
    .pipe(
      z
        .string()
        .min(20, "Give a full reason (at least 20 characters) — this is permanently recorded.")
        .max(500, "Keep the reason under 500 characters."),
    ),
  confirmation: z.literal("CONFIRM", {
    error: "Type CONFIRM to acknowledge this is not a Paystack payment.",
  }),
});

export const paymentFilterSchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z
    .enum(["PENDING", "SUCCESS", "FAILED", "ABANDONED", "REVERSED", "REFUNDED"])
    .optional(),
  sessionId: cuidSchema.optional(),
  departmentId: cuidSchema.optional(),
  level: z.enum(LEVEL_CODES).optional(),
  channel: z.string().trim().max(30).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
export type PaymentFilterInput = z.infer<typeof paymentFilterSchema>;

/** Turn a ZodError into the `details` shape used by the API envelope. */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
