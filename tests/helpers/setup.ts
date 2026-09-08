import { config as loadEnv } from "dotenv";

/**
 * Per-worker environment.
 *
 * Test credentials only — the Paystack "secret key" here is a fixed string used
 * to compute webhook signatures in tests and never leaves the process. Real
 * calls to Paystack are intercepted; see tests/helpers/paystack.ts.
 */
loadEnv({ path: ".env.test", quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
process.env.PAYSTACK_SECRET_KEY = "sk_test_vitest_fixture_key";
process.env.PAYSTACK_PUBLIC_KEY = "pk_test_vitest_fixture_key";
process.env.NEXTAUTH_SECRET = "vitest-secret-value-that-is-long-enough-0123456789";
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.RESEND_API_KEY = "";
process.env.FROM_EMAIL = "";
