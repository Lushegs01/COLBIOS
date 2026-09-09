"use client";

import { useEffect } from "react";

/**
 * The error boundary for the administration area.
 *
 * It exists because the public one does not belong here: its recovery link
 * sends the reader to `/pay`, the student payment form, which is the wrong
 * destination for an administrator whose sessions page just failed. Placed at
 * `app/admin` it covers the sign-in page, the dashboard layout and every page
 * beneath it.
 *
 * Like the public boundary it shows no exception message — an administrator is
 * trusted, but the browser is not the place for a stack trace or a database
 * error. The digest identifies the entry in the server log.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled administration error", error.digest ?? "");
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-soft sm:p-8">
        <h1 className="text-[22px] font-bold tracking-tight text-ink">Something went wrong</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          This page could not be loaded. No payment, fee or session was changed by the failure — an
          action either completed in full or not at all.
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
            href="/admin"
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-line bg-white px-5 text-[15px] font-semibold text-ink hover:border-ink/30"
          >
            Back to the dashboard
          </a>
        </div>

        {error.digest ? (
          <p className="mt-5 font-mono text-[11px] text-muted">
            Reference: {error.digest}
            <span className="mt-1 block font-sans text-muted">
              Quote this when reporting the problem — the full detail is in the server log.
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
