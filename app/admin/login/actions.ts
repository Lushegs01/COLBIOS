"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { recordAudit } from "@/lib/audit/log";
import { authenticateAdmin } from "@/lib/auth/login";
import { clearSessionCookie, readSessionFromCookies } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { clientIdentifier } from "@/lib/rate-limit/limiter";
import { adminLoginSchema } from "@/lib/validation/schemas";

export type LoginState = { error: string | null };

/**
 * Sign in.
 *
 * Every failure — unknown email, wrong password, inactive account, malformed
 * input — returns the same message. Telling the caller *which* part was wrong
 * is how an attacker maps out who the administrators are.
 */
export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = adminLoginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: "Incorrect email or password." };
  }

  const headerList = await headers();
  const outcome = await authenticateAdmin({
    email: parsed.data.email,
    password: parsed.data.password,
    ip: clientIdentifier(headerList),
    userAgent: headerList.get("user-agent"),
  });

  if (!outcome.ok) {
    return {
      error:
        outcome.reason === "rate_limited"
          ? "Too many sign-in attempts. Please try again shortly."
          : "Incorrect email or password.",
    };
  }

  const next = String(formData.get("next") ?? "");
  redirect(safeRedirect(next));
}

export async function logoutAction(): Promise<void> {
  const claims = await readSessionFromCookies();
  await clearSessionCookie();

  if (claims) {
    await recordAudit({
      action: "ADMIN_LOGOUT",
      entityType: "AdminUser",
      entityId: claims.sub,
      adminEmail: claims.email,
    });
    logger.info("admin_logout", { adminEmail: claims.email });
  }

  redirect("/admin/login");
}

/**
 * Only same-site admin paths are accepted as a post-login destination, so a
 * crafted `?next=https://evil.example` link cannot bounce a signed-in
 * administrator off-site.
 */
function safeRedirect(next: string): string {
  if (!next.startsWith("/admin") || next.startsWith("//")) return "/admin";
  return next;
}
