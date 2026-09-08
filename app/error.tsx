"use client";

import { useEffect } from "react";

/**
 * The last line of defence for the public flow.
 *
 * Students never see an exception message, a Prisma error or a stack trace —
 * only this page and a digest they can quote to the college office. The real
 * error is already in the server logs, where it belongs.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Reported to the browser console only; the server has the real detail.
    console.error("Unhandled application error", error.digest ?? "");
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-soft sm:p-8">
        <h1 className="text-[22px] font-bold tracking-tight text-ink">Something went wrong</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          We hit an unexpected problem. Your payment status is unaffected by this page — nothing has
          been charged or changed.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-pine-700 px-5 text-[15px] font-semibold text-white shadow-soft hover:bg-pine-800"
          >
            Try again
          </button>
          <a
            href="/pay"
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-line bg-white px-5 text-[15px] font-semibold text-ink hover:border-ink/30"
          >
            Back to payments
          </a>
        </div>

        {error.digest ? (
          <p className="mt-5 font-mono text-[11px] text-muted">Reference: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
