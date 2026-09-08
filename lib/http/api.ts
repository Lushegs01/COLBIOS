import { NextResponse } from "next/server";

import { describeError, logger } from "@/lib/logger";

/**
 * One JSON envelope for every API route:
 *   { success: true,  data: … }
 *   { success: false, error: { code, message, details? } }
 *
 * `message` is always something we are happy to show a student. Internal
 * exception text, SQL and stack traces never cross this boundary.
 */

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = {
  success: false;
  error: { code: AppErrorCode; message: string; details?: Record<string, string[]> };
};
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const ERROR_CODES = {
  VALIDATION_ERROR: 400,
  INVALID_REQUEST: 400,
  INVALID_LEVEL: 400,
  INVALID_DEPARTMENT: 400,
  INVALID_REFERENCE: 400,
  NO_ACTIVE_SESSION: 409,
  NO_FEE_CONFIGURED: 409,
  PAYMENT_ALREADY_COMPLETED: 409,
  PAYMENT_NOT_FOUND: 404,
  RECEIPT_NOT_FOUND: 404,
  NOT_FOUND: 404,
  DUPLICATE_RESOURCE: 409,
  INVALID_STATE_TRANSITION: 409,
  AMOUNT_MISMATCH: 409,
  CURRENCY_MISMATCH: 409,
  PAYMENT_NOT_SUCCESSFUL: 409,
  PAYMENT_PENDING: 202,
  PROVIDER_UNAVAILABLE: 502,
  PROVIDER_ERROR: 502,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INVALID_CREDENTIALS: 401,
  CSRF_FAILED: 403,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  DATABASE_UNAVAILABLE: 503,
} as const;

export type AppErrorCode = keyof typeof ERROR_CODES;

/** Errors that are safe, by construction, to surface to the caller. */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: Record<string, string[]>;
  /** Extra context for logs only — never serialised into the response. */
  readonly context?: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    message?: string,
    options: { details?: Record<string, string[]>; context?: Record<string, unknown> } = {},
  ) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_CODES[code];
    this.details = options.details;
    this.context = options.context;
  }
}

/** Human-readable fallbacks, used when an error escapes without a message. */
export const DEFAULT_MESSAGES: Record<AppErrorCode, string> = {
  VALIDATION_ERROR: "Please check the details you entered and try again.",
  INVALID_REQUEST: "That request could not be understood.",
  INVALID_LEVEL: "Please select a valid level.",
  INVALID_DEPARTMENT: "Please select a valid department.",
  INVALID_REFERENCE: "That payment reference is not valid.",
  NO_ACTIVE_SESSION:
    "Dues payment is not open at the moment. Please check back later or contact the college office.",
  NO_FEE_CONFIGURED:
    "Dues have not been set for your level yet. Please contact the college office.",
  PAYMENT_ALREADY_COMPLETED: "This dues payment has already been completed.",
  PAYMENT_NOT_FOUND: "We could not find a payment with that reference.",
  RECEIPT_NOT_FOUND: "No receipt has been issued for that payment.",
  NOT_FOUND: "We could not find what you were looking for.",
  DUPLICATE_RESOURCE: "That record already exists.",
  INVALID_STATE_TRANSITION: "That payment cannot be changed from its current state.",
  AMOUNT_MISMATCH:
    "The amount paid does not match the amount due. Please contact the college office.",
  CURRENCY_MISMATCH:
    "The payment currency does not match the amount due. Please contact the college office.",
  PAYMENT_NOT_SUCCESSFUL: "This payment has not been completed.",
  PAYMENT_PENDING: "We are still confirming this payment.",
  PROVIDER_UNAVAILABLE:
    "We could not reach the payment provider. Please try again in a moment.",
  PROVIDER_ERROR: "The payment provider returned an error. Please try again shortly.",
  UNAUTHORIZED: "Please sign in to continue.",
  FORBIDDEN: "You do not have permission to perform this action.",
  INVALID_CREDENTIALS: "Incorrect email or password.",
  CSRF_FAILED: "Your session has expired. Please refresh the page and try again.",
  RATE_LIMITED: "Too many attempts. Please try again shortly.",
  INTERNAL_ERROR: "Something went wrong on our end. Please try again.",
  DATABASE_UNAVAILABLE: "The service is temporarily unavailable. Please try again shortly.",
};

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true as const, data }, init);
}

export function fail(
  code: AppErrorCode,
  message?: string,
  details?: Record<string, string[]>,
  extraHeaders?: HeadersInit,
): NextResponse<ApiFailure> {
  return NextResponse.json(
    {
      success: false as const,
      error: { code, message: message ?? DEFAULT_MESSAGES[code], ...(details ? { details } : {}) },
    },
    { status: ERROR_CODES[code], headers: extraHeaders },
  );
}

/**
 * Final safety net for route handlers. Known AppErrors keep their message;
 * anything else is logged in full and reported as a generic internal error.
 */
export function toErrorResponse(error: unknown, route: string): NextResponse<ApiFailure> {
  if (error instanceof AppError) {
    if (error.status >= 500) {
      logger.error("unexpected_error", { route, code: error.code, ...error.context, ...describeError(error) });
    }
    return fail(error.code, error.message, error.details);
  }

  logger.error("unexpected_error", { route, ...describeError(error) });
  return fail("INTERNAL_ERROR");
}
