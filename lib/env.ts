import "server-only";

/**
 * Server-side environment access.
 *
 * Every secret in the application is read through this module, and this module
 * is `server-only` — importing it from a client component is a build error.
 * That is the mechanical guarantee behind "no secrets in the frontend bundle".
 *
 * Values are read lazily (not at module load) so that a missing variable
 * produces a clear, contained error at the point of use rather than crashing
 * the whole app at boot — a build on Vercel must not fail merely because an
 * optional integration such as email is not configured yet.
 */

export class MissingEnvError extends Error {
  constructor(name: string) {
    super(
      `Missing required environment variable ${name}. See .env.example and docs/DEPLOYMENT.md.`,
    );
    this.name = "MissingEnvError";
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") throw new MissingEnvError(name);
  return value.trim();
}

function optional(name: string, fallback = ""): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : fallback;
}

export const serverEnv = {
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },
  get paystackSecretKey(): string {
    return required("PAYSTACK_SECRET_KEY");
  },
  get paystackPublicKey(): string {
    return optional("PAYSTACK_PUBLIC_KEY");
  },
  get authSecret(): string {
    const secret = required("NEXTAUTH_SECRET");
    if (secret.length < 32) {
      throw new Error(
        "NEXTAUTH_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 32",
      );
    }
    return secret;
  },
  get resendApiKey(): string {
    return optional("RESEND_API_KEY");
  },
  get fromEmail(): string {
    return optional("FROM_EMAIL");
  },
  get nodeEnv(): string {
    return optional("NODE_ENV", "development");
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
  /** True when the configured Paystack key is a test-mode key. */
  get isPaystackTestMode(): boolean {
    return optional("PAYSTACK_SECRET_KEY").startsWith("sk_test");
  },
  get emailEnabled(): boolean {
    return optional("RESEND_API_KEY") !== "" && optional("FROM_EMAIL") !== "";
  },
} as const;

/**
 * The public application URL. Also exposed to the browser via
 * NEXT_PUBLIC_APP_URL — it is not a secret, it is what we build receipt and
 * verification links from.
 */
export function appUrl(): string {
  const explicit =
    optional("NEXT_PUBLIC_APP_URL") ||
    optional("NEXTAUTH_URL") ||
    (optional("VERCEL_PROJECT_PRODUCTION_URL")
      ? `https://${optional("VERCEL_PROJECT_PRODUCTION_URL")}`
      : "") ||
    (optional("VERCEL_URL") ? `https://${optional("VERCEL_URL")}` : "");

  const base = explicit || "http://localhost:3000";
  return base.replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  return `${appUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
