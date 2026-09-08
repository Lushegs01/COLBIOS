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
    );
  }

  return (
    <form onSubmit={submitDetails} noValidate className="space-y-5">
      <ErrorSummary message={formError} issues={fieldIssues} region={errorRegion} />

      <Field
        name="fullName"
        label="Full name"
        hint="As it appears on your student record."
        autoComplete="name"
        defaultValue={values.fullName}
        issues={fieldIssues.fullName}
      />

      <Field
        name="matricNumber"
        label="Matric number"
        hint="For example 2023/123456."
        autoComplete="off"
        inputMode="text"
        defaultValue={values.matricNumber}
        issues={fieldIssues.matricNumber}
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
      />

      <SelectField
        name="departmentId"
        label="Department"
        defaultValue={values.departmentId}
        issues={fieldIssues.departmentId}
        placeholder="Select your department"
        options={departments.map((d) => ({ value: d.id, label: d.name }))}
      />

      <SelectField
        name="level"
        label="Level"
        hint="Your dues amount depends on your level."
        defaultValue={values.level}
        issues={fieldIssues.level}
        placeholder="Select your level"
        options={levels.map((l) => ({ value: l.label, label: l.label }))}
      />

      <div className="pt-1">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-pine-700 px-6 text-[15px] font-semibold text-white shadow-soft transition-colors hover:bg-pine-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? "Checking your details…" : "Continue"}
        </button>
        <p className="mt-3 text-center text-[12.5px] text-muted">
          You will review your details and the exact amount before paying.
        </p>
      </div>

      <p className="text-center text-[12px] text-muted">Academic session {sessionName}</p>
    </form>
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
            className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-pine-700 px-6 text-[15px] font-semibold text-white shadow-soft hover:bg-pine-800"
          >
            View receipt
          </a>
        ) : null}

        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] w-full text-[14px] font-semibold text-pine-700 hover:underline"
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

      <div className="rounded-xl border border-pine-200 bg-pine-50 p-5">
        <p className="text-[12.5px] font-semibold uppercase tracking-wide text-pine-800">
          {quote.feeName}
        </p>
        <p className="mt-1 text-[32px] font-bold leading-none tracking-tight text-pine-900">
          {formatMoney(quote.amount, quote.currency)}
        </p>
        <p className="mt-2 text-[12.5px] text-pine-900/70">
          Set by the College of Biosciences for {quote.levelLabel} students in {quote.sessionName}.
        </p>
      </div>

      <button
        type="button"
        onClick={onPay}
        disabled={busy}
        className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-pine-700 px-6 text-[15px] font-semibold text-white shadow-soft transition-colors hover:bg-pine-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {busy ? "Taking you to Paystack…" : `Pay ${formatMoney(quote.amount, quote.currency)}`}
      </button>

      <button
        type="button"
        onClick={onBack}
        disabled={busy}
        className="min-h-[44px] w-full text-[14px] font-semibold text-pine-700 hover:underline disabled:opacity-60"
      >
        Edit my details
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
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        defaultValue={defaultValue}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={issues?.length ? true : undefined}
        className={`mt-2 block min-h-[48px] w-full rounded-xl border bg-white px-3.5 text-[15px] text-ink shadow-xs outline-none transition-colors placeholder:text-muted/70 focus:border-pine-600 focus:ring-2 focus:ring-pine-600/20 ${
          issues?.length ? "border-red-400" : "border-line"
        }`}
      />
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
}: {
  name: string;
  label: string;
  hint?: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
  issues?: string[];
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
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={issues?.length ? true : undefined}
        className={`mt-2 block min-h-[48px] w-full appearance-none rounded-xl border bg-white bg-[url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="%236B7280"><path d="M5.5 7.5l4.5 4.5 4.5-4.5"/></svg>')] bg-[length:18px] bg-[right_0.9rem_center] bg-no-repeat px-3.5 pr-11 text-[15px] text-ink shadow-xs outline-none transition-colors focus:border-pine-600 focus:ring-2 focus:ring-pine-600/20 ${
          issues?.length ? "border-red-400" : "border-line"
        }`}
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
      {issues?.length ? (
        <p id={errorId} className="mt-1.5 text-[12.5px] font-medium text-red-700">
          {issues.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
