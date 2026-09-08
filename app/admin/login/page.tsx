import type { Metadata } from "next";
import { redirect } from "next/navigation";

import LoginForm from "@/components/admin/LoginForm";
import { getAdminContext } from "@/lib/auth/guard";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administrator sign in — COLBIOS Dues",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const admin = await getAdminContext();
  if (admin) redirect("/admin");

  const { next } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 place-items-center rounded-lg bg-pine-700 text-[13px] font-bold text-white"
          >
            CB
          </span>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-tight text-ink">COLBIOS Dues</p>
            <p className="text-[11.5px] text-muted">Administration</p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h1 className="text-[20px] font-bold tracking-tight text-ink">Sign in</h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
            Authorised college staff only. Every action you take here is recorded.
          </p>

          <LoginForm next={next ?? ""} />
        </div>

        {!serverEnv.isProduction ? (
          <p className="mt-4 text-center text-[12px] leading-relaxed text-muted">
            No account yet? Create the first administrator with{" "}
            <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px] text-ink">
              npm run admin:bootstrap
            </code>
          </p>
        ) : null}
      </div>
    </div>
  );
}
