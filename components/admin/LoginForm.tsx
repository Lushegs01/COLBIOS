"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { loginAction, type LoginState } from "@/app/admin/login/actions";

/**
 * Sign-in form. Uses a server action, so the password is posted directly to the
 * server and no credentials pass through client-side fetch code.
 */
export default function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, { error: null });

  return (
    <form action={formAction} className="mt-5 space-y-4">
      <input type="hidden" name="next" value={next} />

      <div role="alert" aria-live="assertive">
        {state.error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-900">
            {state.error}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="email" className="block text-[13px] font-semibold text-ink">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-1.5 block min-h-[46px] w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink shadow-xs outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/20"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-[13px] font-semibold text-ink">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1.5 block min-h-[46px] w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink shadow-xs outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/20"
        />
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-pine-700 px-5 text-[15px] font-semibold text-white shadow-soft transition-colors hover:bg-pine-800 disabled:opacity-70"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}
