/**
 * Structured logging.
 *
 * One JSON line per event so production logs (Vercel, Datadog, anything that
 * ingests stdout) stay queryable. Every payload passes through a redactor that
 * strips anything that looks like a credential — a log line must never be the
 * reason a secret leaks.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Canonical event names. Keeping them in one union makes logs greppable. */
export type LogEvent =
  | "payment_initialized"
  | "payment_initialization_failed"
  | "payment_reused_pending"
  | "payment_verification_started"
  | "payment_verified"
  | "payment_failed"
  | "payment_amount_mismatch"
  | "payment_currency_mismatch"
  | "payment_already_fulfilled"
  | "webhook_received"
  | "webhook_signature_invalid"
  | "webhook_processed"
  | "webhook_processing_failed"
  | "duplicate_webhook_ignored"
  | "receipt_created"
  | "email_sent"
  | "email_failed"
  | "email_skipped"
  | "admin_login"
  | "admin_login_failed"
  | "admin_logout"
  | "admin_action"
  | "rate_limited"
  | "paystack_request_failed"
  | "unexpected_error";

const SENSITIVE_KEY = /(secret|password|passwd|token|authorization|cookie|apikey|api_key|signature|hash|credential|pin|cvv|card)/i;
const SECRET_VALUE = /\b(sk_(?:test|live)_[a-zA-Z0-9]+|postgres(?:ql)?:\/\/[^\s"]+|re_[a-zA-Z0-9_-]{10,})/g;

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(SECRET_VALUE, "[redacted]");
  }
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") return redact(value as Record<string, unknown>);
  return value;
}

export function redact(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redactValue(value);
  }
  return out;
}

function write(level: LogLevel, event: LogEvent, data: Record<string, unknown>) {
  const line = JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...redact(data),
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug(event: LogEvent, data: Record<string, unknown> = {}) {
    if (process.env.NODE_ENV === "development") write("debug", event, data);
  },
  info(event: LogEvent, data: Record<string, unknown> = {}) {
    write("info", event, data);
  },
  warn(event: LogEvent, data: Record<string, unknown> = {}) {
    write("warn", event, data);
  },
  error(event: LogEvent, data: Record<string, unknown> = {}) {
    write("error", event, data);
  },
};

/** Turn an unknown thrown value into something safe to log (never to return). */
export function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    };
  }
  return { errorName: "UnknownError", errorMessage: String(error) };
}
