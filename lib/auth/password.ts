import bcrypt from "bcryptjs";

/**
 * Password hashing for administrator accounts.
 *
 * Pure hashing helper — no secrets, no database — so scripts (the admin
 * bootstrap) and tests can use exactly the same code as the login route.
 *
 * bcrypt with cost 12: slow enough to make offline cracking expensive, fast
 * enough (~250ms) for an interactive login on a serverless instance. bcryptjs
 * is pure JavaScript, so it works on Vercel without native builds.
 */

const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Run a comparison against a dummy hash when no account was found, so a login
 * attempt takes the same time whether or not the email exists. Without this the
 * response time alone tells an attacker which addresses are administrators.
 */
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO7dQmMkCDy2GHkYSdrKq/9ZpV/pKlTSy";

export async function dummyCompare(plain: string): Promise<void> {
  await bcrypt.compare(plain, DUMMY_HASH).catch(() => false);
}
