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
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-lift"
      >
        Skip to content
      </a>
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
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="COLBIOS home">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-lg bg-pine-700 text-[13px] font-bold text-white"
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
      </div>
    </header>
  );
}

export function PayFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 text-[12px] leading-relaxed text-muted sm:px-6">
        <p>
          Payments are processed by Paystack. COLBIOS never sees or stores your card details.
        </p>
        <p className="mt-1.5">
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
    <Tag className={`rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-7 ${className}`}>
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
    <div className="mb-6">
      {eyebrow ? (
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-pine-700">
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
