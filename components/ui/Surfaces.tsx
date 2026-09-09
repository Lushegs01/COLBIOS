import Link from "next/link";
import type { ReactNode } from "react";

import type { PaymentStatusValue } from "@/lib/payments/state";

/**
 * Layout and status primitives shared by the public payment pages.
 *
 * All server components: the student flow ships as close to zero JavaScript as
 * it can, because a 3G connection on a low-end Android phone is the design
 * target, not a desktop on campus wifi.
 */

export function PayShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-pay-gradient">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-lift"
      >
        Skip to content
      </a>

      {/* Decorative branded stripe at the very top */}
      <div className="pay-stripe h-1" aria-hidden="true" />

      <PayHeader />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>
      <PayFooter />
    </div>
  );
}

export function PayHeader() {
  return (
    <header className="border-b border-line/60 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="COLBIOS home">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-pine-600 to-pine-800 text-[13px] font-bold text-white shadow-sm"
          >
            CB
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-tight text-ink">
              COLBIOS Dues
            </span>
            <span className="block text-[11px] text-muted">College of Biosciences, FUNAAB</span>
          </span>
        </Link>

        {/* Trust signal in header */}
        <span className="hidden items-center gap-1.5 text-[11px] font-medium text-pine-700 sm:flex">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
              clipRule="evenodd"
            />
          </svg>
          Secure payment
        </span>
      </div>
    </header>
  );
}

export function PayFooter() {
  return (
    <footer className="border-t border-line/60 bg-white/60 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        {/* Secured by Paystack badge */}
        <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-pine-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9.661 2.237a.531.531 0 01.678 0 11.947 11.947 0 007.078 2.749.5.5 0 01.479.425c.069.52.104 1.05.104 1.59 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 01-.332 0C5.26 16.564 2 12.163 2 7c0-.538.035-1.069.104-1.589a.5.5 0 01.48-.425 11.947 11.947 0 007.077-2.75z"
              clipRule="evenodd"
            />
          </svg>
          Secured by Paystack
        </div>

        <p className="text-[12px] leading-relaxed text-muted">
          Payments are processed by Paystack. COLBIOS never sees or stores your card details.
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          College of Biosciences, Federal University of Agriculture, Abeokuta.
        </p>
      </div>
    </footer>
  );
}

export function Card({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag
      className={`animate-fade-in-up-delay rounded-2xl border border-line/80 bg-white p-5 shadow-elevated sm:p-7 ${className}`}
    >
      {children}
    </Tag>
  );
}

export function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6 animate-fade-in-up">
      {eyebrow ? (
        <p className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-pine-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-pine-700 ring-1 ring-pine-200/60">
          <span className="h-1.5 w-1.5 rounded-full bg-pine-500" aria-hidden="true" />
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-balance text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[32px]">
        {title}
      </h1>
      {description ? (
        <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{description}</p>
      ) : null}
    </div>
  );
}

/** A label/value row. `mono` is for references, which get read out loud. */
export function DetailRow({
  label,
  value,
  mono = false,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/70 py-3 last:border-0">
      <dt className="shrink-0 text-[13px] text-muted">{label}</dt>
      <dd
        className={`text-right text-[15px] text-ink ${emphasis ? "font-bold" : "font-semibold"} ${
          mono ? "font-mono text-[13px] tracking-tight" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

const STATUS_STYLES: Record<PaymentStatusValue, { chip: string; dot: string; label: string }> = {
  SUCCESS: { chip: "bg-pine-50 text-pine-800 border-pine-200", dot: "bg-pine-600", label: "Successful" },
  PENDING: { chip: "bg-amber-50 text-amber-900 border-amber-200", dot: "bg-amber-500", label: "Pending" },
  FAILED: { chip: "bg-red-50 text-red-900 border-red-200", dot: "bg-red-600", label: "Failed" },
  ABANDONED: { chip: "bg-zinc-100 text-zinc-800 border-zinc-300", dot: "bg-zinc-500", label: "Abandoned" },
  REVERSED: { chip: "bg-orange-50 text-orange-900 border-orange-200", dot: "bg-orange-500", label: "Reversed" },
  REFUNDED: { chip: "bg-sky-50 text-sky-900 border-sky-200", dot: "bg-sky-600", label: "Refunded" },
};

/**
 * Status is communicated by three signals at once — text, shape and colour —
 * so it still reads correctly in greyscale or with colour-blindness.
 */
export function StatusBadge({ status }: { status: PaymentStatusValue }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-bold ${style.chip}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

/** Non-blocking informational callout. */
export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "error" | "success";
  title: string;
  children?: ReactNode;
}) {
  const tones = {
    info: "border-line bg-white",
    warning: "border-amber-200 bg-amber-50",
    error: "border-red-200 bg-red-50",
    success: "border-pine-200 bg-pine-50",
  } as const;

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`} role={tone === "error" ? "alert" : undefined}>
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      {children ? <div className="mt-1 text-[13.5px] leading-relaxed text-muted">{children}</div> : null}
    </div>
  );
}
