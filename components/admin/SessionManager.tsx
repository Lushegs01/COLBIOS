"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { IDLE, type ActionState } from "@/app/admin/(dashboard)/action-state";
import {
  activateSessionAction,
  createSessionAction,
  deactivateSessionAction,
} from "@/app/admin/(dashboard)/sessions/actions";
import { formatMoney } from "@/lib/format/money";

type SessionRow = {
  id: string;
  name: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  activeFeeCount: number;
  paymentCount: number;
  collectedMinor: number;
};

export default function SessionManager({
  sessions,
  canWrite,
  csrf,
}: {
  sessions: SessionRow[];
  canWrite: boolean;
  csrf: string;
}) {
  const [createState, create] = useActionState<ActionState, FormData>(createSessionAction, IDLE);
  const [activateState, activate] = useActionState<ActionState, FormData>(activateSessionAction, IDLE);
  const [deactivateState, deactivate] = useActionState<ActionState, FormData>(
    deactivateSessionAction,
    IDLE,
  );

  return (
    <div className="space-y-4">
      <Feedback state={activateState} />
      <Feedback state={deactivateState} />

      <section className="rounded-2xl border border-line bg-white shadow-soft">
        <header className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-bold tracking-tight text-ink">Academic sessions</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Exactly one session can be active. Activating a session opens payment for students.
          </p>
        </header>

        <div className="divide-y divide-line">
          {sessions.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13.5px] text-muted">No sessions yet.</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-[15px] font-bold text-ink">{session.name}</h3>
                    {session.active ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-pine-200 bg-pine-50 px-2 py-0.5 text-[11px] font-bold text-pine-800">
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-pine-600" />
                        ACTIVE
                      </span>
                    ) : (
                      <span className="rounded-full border border-line bg-background px-2 py-0.5 text-[11px] font-bold text-muted">
                        INACTIVE
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted">
                    {session.activeFeeCount} active{" "}
                    {session.activeFeeCount === 1 ? "level" : "levels"} ·{" "}
                    {session.paymentCount.toLocaleString("en-NG")} payments ·{" "}
                    {formatMoney(session.collectedMinor)} collected
                    {session.startsAt ? ` · ${session.startsAt}` : ""}
                    {session.endsAt ? ` to ${session.endsAt}` : ""}
                  </p>
                </div>

                {canWrite ? (
                  <form action={session.active ? deactivate : activate}>
                    <input type="hidden" name="csrf" value={csrf} />
                    <input type="hidden" name="id" value={session.id} />
                    <SubmitButton
                      idle={session.active ? "Deactivate" : "Activate"}
                      busy="Working…"
                      variant={session.active ? "secondary" : "primary"}
                    />
                  </form>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      {canWrite ? (
        <section className="rounded-2xl border border-line bg-white shadow-soft">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-bold tracking-tight text-ink">Create a session</h2>
          </header>
          <div className="p-5">
            <Feedback state={createState} />
            <form action={create} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="csrf" value={csrf} />

              <div className="w-44">
                <label htmlFor="name" className="block text-[11.5px] font-semibold text-muted">
                  Session
                </label>
                <input
                  id="name"
                  name="name"
                  placeholder="2027/2028"
                  required
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-line px-3 text-[13.5px] text-ink outline-none focus:border-pine-600"
                />
              </div>

              <div className="w-44">
                <label htmlFor="startsAt" className="block text-[11.5px] font-semibold text-muted">
                  Starts (optional)
                </label>
                <input
                  id="startsAt"
                  name="startsAt"
                  type="date"
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-line px-3 text-[13.5px] text-ink outline-none focus:border-pine-600"
                />
              </div>

              <div className="w-44">
                <label htmlFor="endsAt" className="block text-[11.5px] font-semibold text-muted">
                  Ends (optional)
                </label>
                <input
                  id="endsAt"
                  name="endsAt"
                  type="date"
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-line px-3 text-[13.5px] text-ink outline-none focus:border-pine-600"
                />
              </div>

              <SubmitButton idle="Create session" busy="Creating…" variant="primary" />
            </form>
          </div>
        </section>
      ) : (
        <p className="text-[12.5px] text-muted">
          Your role can view sessions but not change them.
        </p>
      )}
    </div>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (!state.error && !state.success) return null;
  return (
    <div role="status" aria-live="polite">
      <p
        className={`rounded-lg border px-3 py-2 text-[13px] font-medium ${
          state.error
            ? "border-red-200 bg-red-50 text-red-900"
            : "border-pine-200 bg-pine-50 text-pine-900"
        }`}
      >
        {state.error ?? state.success}
      </p>
    </div>
  );
}

function SubmitButton({
  idle,
  busy,
  variant,
}: {
  idle: string;
  busy: string;
  variant: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex min-h-[40px] items-center justify-center rounded-lg px-4 text-[13px] font-semibold transition-colors disabled:opacity-60 ${
        variant === "primary"
          ? "bg-pine-700 text-white hover:bg-pine-800"
          : "border border-line bg-white text-ink hover:border-ink/30"
      }`}
    >
      {pending ? busy : idle}
    </button>
  );
}
