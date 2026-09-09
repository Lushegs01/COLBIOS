import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Guards the property that a *build* needs no credentials.
 *
 * `next build` imports every route module to collect page data. If any of them
 * reads a secret at module scope, the build fails on a deployment platform
 * before the environment variables are configured — which is exactly how the
 * first deployment of this app broke: the Prisma client was constructed on
 * import, so `next build` demanded DATABASE_URL and Vercel reported an error.
 *
 * These tests import the affected modules with the environment stripped and
 * assert that importing is side-effect free, and that the missing variable is
 * reported clearly at the point of *use* instead.
 */
describe("modules import without credentials", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
    delete process.env.PAYSTACK_SECRET_KEY;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    process.env = { ...saved };
    vi.resetModules();
  });

  it("imports the database client with no DATABASE_URL", async () => {
    await expect(import("@/lib/db/prisma")).resolves.toBeDefined();
  });

  it("reports the missing variable only when the database is actually used", async () => {
    const { prisma } = await import("@/lib/db/prisma");

    // Touching a delegate is what builds the client, and that is where the
    // error belongs — a clear message naming the variable and the docs.
    expect(() => prisma.payment).toThrowError(/DATABASE_URL/);
  });

  it("imports the Paystack client with no secret key", async () => {
    await expect(import("@/lib/paystack/client")).resolves.toBeDefined();
  });

  it("imports the session module with no auth secret", async () => {
    await expect(import("@/lib/auth/session")).resolves.toBeDefined();
  });

  it("imports the email sender with no Resend key", async () => {
    await expect(import("@/lib/email/send")).resolves.toBeDefined();
  });

  it("imports the payment service, the widest module in the app", async () => {
    await expect(import("@/lib/payments/service")).resolves.toBeDefined();
  });

  it("reads the app URL without any environment at all", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXTAUTH_URL;

    const { appUrl } = await import("@/lib/env");
    expect(appUrl()).toBe("http://localhost:3000");
  });
});
