import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Administrator sessions.
 *
 * A signed JWT in an HttpOnly, Secure, SameSite=Lax cookie. Signed rather than
 * stored so a session survives a serverless cold start, and short-lived (8h)
 * with the account's state re-read from the database on every request — a
 * deactivated admin loses access immediately, not when their token expires.
 */

export const SESSION_COOKIE = "colbios_admin_session";
export const CSRF_COOKIE = "colbios_admin_csrf";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const ISSUER = "colbios-dues";
const AUDIENCE = "colbios-admin";

export type AdminRoleValue = "SUPER_ADMIN" | "ADMIN" | "FINANCE";

export type SessionClaims = {
  sub: string;
  email: string;
  name: string;
  role: AdminRoleValue;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(serverEnv.authSecret);
}

export async function createSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ email: claims.email, name: claims.name, role: claims.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function readSessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role as AdminRoleValue,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(claims: SessionClaims): Promise<void> {
  const token = await createSessionToken(claims);
  const store = await cookies();

  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: serverEnv.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  // Double-submit CSRF token. Readable by JavaScript on purpose: the admin UI
  // echoes it back in a form field, and an attacker's origin cannot read it.
  store.set(CSRF_COOKIE, crypto.randomUUID(), {
    httpOnly: false,
    secure: serverEnv.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(CSRF_COOKIE);
}

export async function readSessionFromCookies(): Promise<SessionClaims | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionToken(token);
}

/**
 * Double-submit CSRF check for admin mutations. Server Actions carry their own
 * origin checks in Next.js; this is the belt to that braces, and covers the
 * admin JSON endpoints too.
 */
export async function assertCsrf(submittedToken: string | null | undefined): Promise<boolean> {
  const store = await cookies();
  const expected = store.get(CSRF_COOKIE)?.value;
  if (!expected || !submittedToken) return false;
  if (expected.length !== submittedToken.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ submittedToken.charCodeAt(i);
  }
  const valid = mismatch === 0;
  if (!valid) logger.warn("admin_action", { action: "CSRF_REJECTED" });
  return valid;
}

export async function currentCsrfToken(): Promise<string> {
  const store = await cookies();
  return store.get(CSRF_COOKIE)?.value ?? "";
}
