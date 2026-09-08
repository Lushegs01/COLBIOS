import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Administrator authentication and authorization.
 *
 * `next/headers` only exists inside a request, so the cookie store is replaced
 * with an in-memory one. Everything else — password hashing, rate limiting,
 * audit writes, the database reads that back a session — is the real code.
 */
const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
  headers: async () => new Headers(),
}));

const { prisma } = await import("@/lib/db/prisma");
const { authenticateAdmin } = await import("@/lib/auth/login");
const { getAdminContext, requireAdminApi } = await import("@/lib/auth/guard");
const { hashPassword, verifyPassword } = await import("@/lib/auth/password");
const { createSessionToken, readSessionToken, assertCsrf, SESSION_COOKIE, CSRF_COOKIE } =
  await import("@/lib/auth/session");
const { resetDatabase } = await import("../helpers/db");

const PASSWORD = "Correct-Horse-9!";

async function createAdmin(overrides: Partial<{ email: string; role: string; active: boolean }> = {}) {
  return prisma.adminUser.create({
    data: {
      email: overrides.email ?? "finance@example.edu",
      name: "Finance Officer",
      passwordHash: await hashPassword(PASSWORD),
      role: (overrides.role ?? "FINANCE") as "FINANCE" | "ADMIN" | "SUPER_ADMIN",
      active: overrides.active ?? true,
    },
  });
}

describe("administrator authentication", () => {
  beforeEach(async () => {
    cookieJar.clear();
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("signs in a valid administrator and records it", async () => {
    const admin = await createAdmin();

    const outcome = await authenticateAdmin({
      email: admin.email,
      password: PASSWORD,
      ip: "198.51.100.1",
      userAgent: "vitest",
    });

    expect(outcome).toMatchObject({ ok: true, role: "FINANCE" });
    expect(cookieJar.has(SESSION_COOKIE)).toBe(true);
    expect(cookieJar.has(CSRF_COOKIE)).toBe(true);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "ADMIN_LOGIN" } });
    expect(audit.adminEmail).toBe(admin.email);
    expect(JSON.stringify(audit.metadata)).not.toContain(PASSWORD);

    const refreshed = await prisma.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
    expect(refreshed.lastLoginAt).not.toBeNull();
  });

  it("rejects a wrong password with the same answer as an unknown account", async () => {
    await createAdmin();

    const wrongPassword = await authenticateAdmin({
      email: "finance@example.edu",
      password: "Wrong-Password-1!",
      ip: "198.51.100.2",
      userAgent: null,
    });
    const unknownAccount = await authenticateAdmin({
      email: "nobody@example.edu",
      password: PASSWORD,
      ip: "198.51.100.3",
      userAgent: null,
    });

    expect(wrongPassword).toEqual({ ok: false, reason: "invalid" });
    expect(unknownAccount).toEqual({ ok: false, reason: "invalid" });
    expect(cookieJar.has(SESSION_COOKIE)).toBe(false);
  });

  it("refuses a deactivated account", async () => {
    await createAdmin({ active: false });

    const outcome = await authenticateAdmin({
      email: "finance@example.edu",
      password: PASSWORD,
      ip: "198.51.100.4",
      userAgent: null,
    });

    expect(outcome).toEqual({ ok: false, reason: "invalid" });
  });

  it("records every failed attempt for review", async () => {
    await createAdmin();
    await authenticateAdmin({
      email: "finance@example.edu",
      password: "Wrong-Password-1!",
      ip: "198.51.100.5",
      userAgent: null,
    });

    const failures = await prisma.auditLog.count({ where: { action: "ADMIN_LOGIN_FAILED" } });
    expect(failures).toBe(1);
  });

  it("rate limits repeated failures against one account", async () => {
    await createAdmin();

    const outcomes = [];
    for (let attempt = 0; attempt < 12; attempt += 1) {
      outcomes.push(
        await authenticateAdmin({
          email: "finance@example.edu",
          password: "Wrong-Password-1!",
          // A different IP each time: the per-account limit is what must bite.
          ip: `198.51.100.${100 + attempt}`,
          userAgent: null,
        }),
      );
    }

    expect(outcomes.some((outcome) => !outcome.ok && outcome.reason === "rate_limited")).toBe(true);

    // Even the correct password is refused while the account is throttled.
    const throttled = await authenticateAdmin({
      email: "finance@example.edu",
      password: PASSWORD,
      ip: "198.51.100.200",
      userAgent: null,
    });
    expect(throttled).toEqual({ ok: false, reason: "rate_limited" });
  });
});

describe("session tokens", () => {
  it("round-trips claims through a signed token", async () => {
    const token = await createSessionToken({
      sub: "admin-id",
      email: "finance@example.edu",
      name: "Finance Officer",
      role: "FINANCE",
    });

    expect(await readSessionToken(token)).toMatchObject({
      sub: "admin-id",
      role: "FINANCE",
    });
  });

  it("rejects a tampered or unsigned token", async () => {
    const token = await createSessionToken({
      sub: "admin-id",
      email: "finance@example.edu",
      name: "Finance Officer",
      role: "FINANCE",
    });

    // Flip a character in the payload segment.
    const [header, payload, signature] = token.split(".");
    const tampered = `${header}.${payload.slice(0, -2)}XX.${signature}`;

    expect(await readSessionToken(tampered)).toBeNull();
    expect(await readSessionToken("not.a.token")).toBeNull();
    expect(await readSessionToken("")).toBeNull();

    // An unsigned "alg: none" token must not be accepted either.
    const none = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${payload}.`;
    expect(await readSessionToken(none)).toBeNull();
  });
});

describe("authorization guards", () => {
  beforeEach(async () => {
    cookieJar.clear();
    await resetDatabase();
  });

  it("returns no context without a session cookie", async () => {
    expect(await getAdminContext()).toBeNull();
    await expect(requireAdminApi()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("re-reads the account, so a deactivation takes effect immediately", async () => {
    const admin = await createAdmin();
    await authenticateAdmin({
      email: admin.email,
      password: PASSWORD,
      ip: "198.51.100.6",
      userAgent: null,
    });

    expect(await getAdminContext()).toMatchObject({ email: admin.email });

    // The token is still valid, but the account is not.
    await prisma.adminUser.update({ where: { id: admin.id }, data: { active: false } });
    expect(await getAdminContext()).toBeNull();
  });

  it("enforces permissions per role, not per navigation link", async () => {
    const admin = await createAdmin({ email: "admin@example.edu", role: "ADMIN" });
    await authenticateAdmin({
      email: admin.email,
      password: PASSWORD,
      ip: "198.51.100.7",
      userAgent: null,
    });

    await expect(requireAdminApi("payments:read")).resolves.toMatchObject({ role: "ADMIN" });
    // An ADMIN may not change fees or record manual payments.
    await expect(requireAdminApi("fees:write")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(requireAdminApi("payments:adjust")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(requireAdminApi("admins:manage")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reflects a role change on the next request", async () => {
    const admin = await createAdmin({ email: "promote@example.edu", role: "ADMIN" });
    await authenticateAdmin({
      email: admin.email,
      password: PASSWORD,
      ip: "198.51.100.8",
      userAgent: null,
    });

    await expect(requireAdminApi("fees:write")).rejects.toMatchObject({ code: "FORBIDDEN" });

    await prisma.adminUser.update({ where: { id: admin.id }, data: { role: "SUPER_ADMIN" } });
    await expect(requireAdminApi("fees:write")).resolves.toMatchObject({ role: "SUPER_ADMIN" });
  });
});

describe("CSRF double-submit check", () => {
  beforeEach(() => cookieJar.clear());

  it("accepts a token matching the cookie", async () => {
    cookieJar.set(CSRF_COOKIE, "token-value-123");
    expect(await assertCsrf("token-value-123")).toBe(true);
  });

  it("rejects a missing, empty or wrong token", async () => {
    cookieJar.set(CSRF_COOKIE, "token-value-123");
    expect(await assertCsrf("wrong-value-123")).toBe(false);
    expect(await assertCsrf("")).toBe(false);
    expect(await assertCsrf(null)).toBe(false);
    expect(await assertCsrf("token-value-1234")).toBe(false);
  });

  it("rejects everything when no CSRF cookie is set", async () => {
    expect(await assertCsrf("anything")).toBe(false);
  });
});

describe("password hashing", () => {
  it("never stores the password itself", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash).not.toContain(PASSWORD);
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("produces a different hash each time and still verifies", async () => {
    const first = await hashPassword(PASSWORD);
    const second = await hashPassword(PASSWORD);

    expect(first).not.toBe(second);
    expect(await verifyPassword(PASSWORD, first)).toBe(true);
    expect(await verifyPassword(PASSWORD, second)).toBe(true);
    expect(await verifyPassword("Wrong-Password-1!", first)).toBe(false);
  });

  it("returns false rather than throwing on a corrupt hash", async () => {
    expect(await verifyPassword(PASSWORD, "not-a-bcrypt-hash")).toBe(false);
  });
});
