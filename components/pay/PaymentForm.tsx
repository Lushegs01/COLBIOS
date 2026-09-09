"use client";

import { useRef, useState } from "react";

import { formatMoney } from "@/lib/format/money";

/**
 * The student payment flow: details → review → Paystack.
 *
 * Notice what this component never does: it never computes or submits an
 * amount. It posts identity fields, the server answers with the amount owed,
 * and that answer is only ever *displayed*. If someone edits the response in
 * their browser, the server still charges what the database says.
 *
 * The only client-side JavaScript on the public flow lives here, and it is kept
 * deliberately small — no form library, no animation, no state manager.
 */

type Department = { id: string; name: string; code: string };
type LevelOption = { level: string; label: string; amount: number; currency: string };

type Quote = {
  fullName: string;
  matricNumber: string;
  email: string;
  department: string;
  departmentId: string;
  level: string;
  levelLabel: string;
  sessionName: string;
  feeName: string;
  amount: number;
  currency: string;
  alreadyPaid: boolean;
  existingReference: string | null;
};

type ApiError = { code: string; message: string; details?: Record<string, string[]> };

type Props = {
  departments: Department[];
  levels: LevelOption[];
  sessionName: string;
};

const FIELD_LABELS: Record<string, string> = {
  fullName: "Full name",
  matricNumber: "Matric number",
  email: "Email address",
  departmentId: "Department",
  level: "Level",
};

/** Inline SVG icons — keeps the bundle tiny vs importing the full lucide-react library. */
function IconUser({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconHash({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}
function IconMail({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
function IconBuilding({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M8 10h.01" /><path d="M16 10h.01" /><path d="M8 14h.01" /><path d="M16 14h.01" />
    </svg>
  );
}
function IconLayers({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22.03 12.43-9.2 4.18a2.12 2.12 0 0 1-1.66 0l-9.2-4.18" />
      <path d="m22.03 16.43-9.2 4.18a2.12 2.12 0 0 1-1.66 0l-9.2-4.18" />
    </svg>
  );
}
function IconLock({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
    </svg>
  );
}
function IconShield({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path fillRule="evenodd" d="M9.661 2.237a.531.531 0 01.678 0 11.947 11.947 0 007.078 2.749.5.5 0 01.479.425c.069.52.104 1.05.104 1.59 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 01-.332 0C5.26 16.564 2 12.163 2 7c0-.538.035-1.069.104-1.589a.5.5 0 01.48-.425 11.947 11.947 0 007.077-2.75z" clipRule="evenodd" />
    </svg>
  );
}
function IconCheck({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  );
}

/** Step indicator — shows progress in the payment flow. */
function StepIndicator({ current }: { current: "details" | "review" }) {
  const steps = [
    { key: "details", label: "Your details" },
    { key: "review", label: "Review & pay" },
  ] as const;
  const currentIndex = current === "details" ? 0 : 1;

  return (
    <div className="mb-6 flex items-center gap-3" aria-label="Payment steps">
      {steps.map((step, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;

        return (
          <div key={step.key} className="flex items-center gap-3">
            {i > 0 && (
              <div
                className={`h-px w-8 transition-colors duration-300 ${
                  isDone ? "bg-pine-500" : "bg-line"
                }`}
              />
            )}
            <div className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300 ${
                  isDone
                    ? "bg-pine-600 text-white"
                    : isActive
                      ? "bg-pine-700 text-white shadow-sm ring-[3px] ring-pine-600/15"
                      : "bg-gray-100 text-muted"
                }`}
              >
                {isDone ? <IconCheck className="h-3 w-3" /> : i + 1}
              </span>
              <span
                className={`text-[12px] font-semibold transition-colors duration-300 ${
                  isActive ? "text-pine-700" : isDone ? "text-pine-600" : "text-muted"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PaymentForm({ departments, levels, sessionName }: Props) {
  const [step, setStep] = useState<"details" | "review">("details");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [fieldIssues, setFieldIssues] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Held in state, not a ref: these values are rendered back into the form when
  // the student steps back from the review screen.
  const [values, setValues] = useState<Record<string, string>>({});
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const errorRegion = useRef<HTMLDivElement>(null);

  async function submitDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const data = new FormData(event.currentTarget);
    const payload = {
      fullName: String(data.get("fullName") ?? ""),
      matricNumber: String(data.get("matricNumber") ?? ""),
      email: String(data.get("email") ?? ""),
      departmentId: String(data.get("departmentId") ?? ""),
      level: String(data.get("level") ?? ""),
    };
    setValues(payload);

    setBusy(true);
    setFormError(null);
    setFieldIssues({});

    try {
      const response = await fetch("/api/payments/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!body.success) {
        applyError(body.error as ApiError);
        return;
      }

      setQuote(body.data as Quote);
      setStep("review");
      requestAnimationFrame(() => reviewHeading.current?.focus());
    } catch {
      setFormError("We could not reach the server. Check your connection and try again.");
      requestAnimationFrame(() => errorRegion.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  async function startCheckout() {
    if (busy) return;
    setBusy(true);
    setFormError(null);

    try {
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json();

      if (!body.success) {
        applyError(body.error as ApiError);
        setBusy(false);
        return;
      }

      // Hand over to Paystack. `busy` stays true so the button cannot be
      // pressed twice while the browser navigates.
      window.location.assign(body.data.authorizationUrl as string);
    } catch {
      setFormError("We could not start your payment. Check your connection and try again.");
      setBusy(false);
      requestAnimationFrame(() => errorRegion.current?.focus());
    }
  }

  function applyError(error: ApiError) {
    if (error.details) setFieldIssues(error.details);
    setFormError(error.message);
    if (error.details && Object.keys(error.details).length > 0) setStep("details");
    requestAnimationFrame(() => errorRegion.current?.focus());
  }

  if (step === "review" && quote) {
    return (
      <>
        <StepIndicator current="review" />
        <ReviewStep
          quote={quote}
          busy={busy}
          formError={formError}
          errorRegion={errorRegion}
          headingRef={reviewHeading}
          onBack={() => {
            setStep("details");
            setFormError(null);
          }}
          onPay={startCheckout}
        />
      </>
    );
  }

  return (
    <>
      <StepIndicator current="details" />
      <form onSubmit={submitDetails} noValidate className="space-y-5">
        <ErrorSummary message={formError} issues={fieldIssues} region={errorRegion} />

        <Field
          name="fullName"
          label="Full name"
          hint="As it appears on your student record."
          autoComplete="name"
          defaultValue={values.fullName}
          issues={fieldIssues.fullName}
          icon={<IconUser />}
        />

        <Field
          name="matricNumber"
          label="Matric number"
          hint="For example 2023/123456."
          autoComplete="off"
          inputMode="text"
          defaultValue={values.matricNumber}
          issues={fieldIssues.matricNumber}
          icon={<IconHash />}
        />

        <Field
          name="email"
          label="Email address"
          type="email"
          hint="Your receipt and payment confirmation are sent here."
          autoComplete="email"
          inputMode="email"
          defaultValue={values.email}
          issues={fieldIssues.email}
          icon={<IconMail />}
        />

        <SelectField
          name="departmentId"
          label="Department"
          defaultValue={values.departmentId}
          issues={fieldIssues.departmentId}
          placeholder="Select your department"
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
          icon={<IconBuilding />}
        />

        <SelectField
          name="level"
          label="Level"
          hint="Your dues amount depends on your level."
          defaultValue={values.level}
          issues={fieldIssues.level}
          placeholder="Select your level"
          options={levels.map((l) => ({ value: l.label, label: l.label }))}
          icon={<IconLayers />}
        />

        <div className="pt-2">
          {/* Trust signal */}
          <div className="mb-3 flex items-center justify-center gap-1.5 text-[11.5px] text-muted">
            <IconLock className="h-3 w-3" />
            <span>Your information is encrypted and secure</span>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="group relative inline-flex min-h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-b from-pine-600 to-pine-700 px-6 text-[15px] font-semibold text-white shadow-soft transition-all duration-200 hover:from-pine-700 hover:to-pine-800 hover:shadow-glow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {busy ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Checking your details…
              </>
            ) : (
              "Continue"
            )}
          </button>

          <p className="mt-3 text-center text-[12.5px] text-muted">
            You will review your details and the exact amount before paying.
          </p>
        </div>

        <p className="text-center text-[12px] text-muted">Academic session {sessionName}</p>
      </form>
    </>
  );
}

function ReviewStep({
  quote,
  busy,
  formError,
  errorRegion,
  headingRef,
  onBack,
  onPay,
}: {
  quote: Quote;
  busy: boolean;
  formError: string | null;
  errorRegion: React.RefObject<HTMLDivElement | null>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onPay: () => void;
}) {
  if (quote.alreadyPaid) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-pine-200 bg-pine-50 p-5">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-[17px] font-bold text-pine-900 focus:outline-none"
          >
            Payment complete
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-pine-900/80">
            Your COLBIOS dues for the {quote.sessionName} session have already been paid with matric
            number {quote.matricNumber}.
          </p>
        </div>

        {quote.existingReference ? (
          <a
            href={`/receipt/${quote.existingReference}`}
            className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-gradient-to-b from-pine-600 to-pine-700 px-6 text-[15px] font-semibold text-white shadow-soft transition-all duration-200 hover:from-pine-700 hover:to-pine-800 hover:shadow-glow"
          >
            View receipt
          </a>
        ) : null}

        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] w-full text-[14px] font-semibold text-pine-700 transition-colors hover:text-pine-800 hover:underline"
        >
          Use different details
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ErrorSummary message={formError} issues={{}} region={errorRegion} />

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-[17px] font-bold tracking-tight text-ink focus:outline-none"
      >
        Review your payment
      </h2>

      <dl className="rounded-xl border border-line bg-white px-4 sm:px-5">
        <Row label="Full name" value={quote.fullName} />
        <Row label="Matric number" value={quote.matricNumber} mono />
        <Row label="Department" value={quote.department} />
        <Row label="Level" value={quote.levelLabel} />
        <Row label="Academic session" value={quote.sessionName} />
        <Row label="Email" value={quote.email} />
      </dl>

      {/* Premium amount display */}
      <div className="relative overflow-hidden rounded-xl border border-pine-200 bg-gradient-to-br from-pine-50 via-pine-50 to-pine-100 p-5">
        {/* Subtle decorative circle */}
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-pine-200/30" aria-hidden="true" />
        <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-pine-200/20" aria-hidden="true" />

        <div className="relative">
          <p className="text-[12.5px] font-semibold uppercase tracking-wide text-pine-800">
            {quote.feeName}
          </p>
          <p className="mt-1.5 text-[36px] font-bold leading-none tracking-tight text-pine-900">
            {formatMoney(quote.amount, quote.currency)}
          </p>
          <p className="mt-2 text-[12.5px] text-pine-900/70">
            Set by the College of Biosciences for {quote.levelLabel} students in {quote.sessionName}.
          </p>
        </div>
      </div>

      <div className="pt-1">
        <button
          type="button"
          onClick={onPay}
          disabled={busy}
          className="group relative inline-flex min-h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-b from-pine-600 to-pine-700 px-6 text-[15px] font-semibold text-white shadow-soft transition-all duration-200 hover:from-pine-700 hover:to-pine-800 hover:shadow-glow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Taking you to Paystack…
            </>
          ) : (
            <>
              <IconShield className="h-4 w-4" />
              Pay {formatMoney(quote.amount, quote.currency)}
            </>
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        disabled={busy}
        className="min-h-[44px] w-full text-[14px] font-semibold text-pine-700 transition-colors hover:text-pine-800 hover:underline disabled:opacity-60"
      >
        ← Edit my details
      </button>

      <p className="text-center text-[12px] leading-relaxed text-muted">
        You will be taken to Paystack to complete payment. Your card details are entered on
        Paystack&apos;s secure page and are never seen by COLBIOS.
      </p>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/70 py-3 last:border-0">
      <dt className="shrink-0 text-[13px] text-muted">{label}</dt>
      <dd
        className={`break-words text-right text-[14.5px] font-semibold text-ink ${
          mono ? "font-mono text-[13px]" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function ErrorSummary({
  message,
  issues,
  region,
}: {
  message: string | null;
  issues: Record<string, string[]>;
  region: React.RefObject<HTMLDivElement | null>;
}) {
  const entries = Object.entries(issues);
  return (
    <div ref={region} tabIndex={-1} role="alert" aria-live="assertive" className="focus:outline-none">
      {message ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-[14px] font-semibold text-red-900">{message}</p>
          {entries.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-red-900/85">
              {entries.map(([field, messages]) => (
                <li key={field}>
                  <span className="font-semibold">{FIELD_LABELS[field] ?? field}:</span>{" "}
                  {messages.join(" ")}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type FieldProps = {
  name: string;
  label: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "email";
  defaultValue?: string;
  issues?: string[];
  icon?: React.ReactNode;
};

function Field({
  name,
  label,
  hint,
  type = "text",
  autoComplete,
  inputMode,
  defaultValue,
  issues,
  icon,
}: FieldProps) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = issues?.length ? `${name}-error` : undefined;

  return (
    <div>
      <label htmlFor={name} className="block text-[13.5px] font-semibold text-ink">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="mt-1 text-[12.5px] text-muted">
          {hint}
        </p>
      ) : null}
      <div className="relative mt-2">
        {icon && (
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/60">
            {icon}
          </div>
        )}
        <input
          id={name}
          name={name}
          type={type}
          autoComplete={autoComplete}
          inputMode={inputMode}
          defaultValue={defaultValue}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          aria-invalid={issues?.length ? true : undefined}
          className={`input-premium block min-h-[48px] w-full rounded-xl border bg-white text-[15px] text-ink shadow-xs outline-none placeholder:text-muted/70 ${
            icon ? "pl-10 pr-3.5" : "px-3.5"
          } ${issues?.length ? "border-red-400" : "border-line"}`}
        />
      </div>
      {issues?.length ? (
        <p id={errorId} className="mt-1.5 text-[12.5px] font-medium text-red-700">
          {issues.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

function SelectField({
  name,
  label,
  hint,
  placeholder,
  options,
  defaultValue,
  issues,
  icon,
}: {
  name: string;
  label: string;
  hint?: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
  issues?: string[];
  icon?: React.ReactNode;
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = issues?.length ? `${name}-error` : undefined;

  return (
    <div>
      <label htmlFor={name} className="block text-[13.5px] font-semibold text-ink">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="mt-1 text-[12.5px] text-muted">
          {hint}
        </p>
      ) : null}
      <div className="relative mt-2">
        {icon && (
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/60">
            {icon}
          </div>
        )}
        <select
          id={name}
          name={name}
          defaultValue={defaultValue ?? ""}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          aria-invalid={issues?.length ? true : undefined}
          className={`input-premium block min-h-[48px] w-full appearance-none rounded-xl border bg-white bg-[url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="%236B7280"><path d="M5.5 7.5l4.5 4.5 4.5-4.5"/></svg>')] bg-[length:18px] bg-[right_0.9rem_center] bg-no-repeat pr-11 text-[15px] text-ink shadow-xs outline-none ${
            icon ? "pl-10" : "px-3.5"
          } ${issues?.length ? "border-red-400" : "border-line"}`}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {issues?.length ? (
        <p id={errorId} className="mt-1.5 text-[12.5px] font-medium text-red-700">
          {issues.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
