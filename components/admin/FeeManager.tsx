"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  IDLE,
  createFeeAction,
  toggleFeeAction,
  updateFeeAction,
} from "@/app/admin/(dashboard)/fees/actions";
import type { ActionState } from "@/app/admin/(dashboard)/payments/actions";
import { LEVEL_CODES, levelLabel, type LevelCode } from "@/lib/format/level";
import { formatMoney, minorToMajorString } from "@/lib/format/money";

type Fee = {
  id: string;
  level: string;
  name: string;
  amount: number;
  currency: string;
  active: boolean;
};

type Session = { id: string; name: string; active: boolean; fees: Fee[] };

/**
 * Fee editing.
 *
 * Amounts are typed in naira and converted to kobo on the server — the browser
 * never submits a minor-unit figure, and never decides what is valid.
 */
export default function FeeManager({
  sessions,
  selectedSessionId,
  canWrite,
  csrf,
}: {
  sessions: Session[];
  selectedSessionId: string;
  canWrite: boolean;
  csrf: string;
}) {
  const session = sessions.find((item) => item.id === selectedSessionId) ?? sessions[0];
  const [createState, create] = useActionState<ActionState, FormData>(createFeeAction, IDLE);
  const [updateState, update] = useActionState<ActionState, FormData>(updateFeeAction, IDLE);
  const [toggleState, toggle] = useActionState<ActionState, FormData>(toggleFeeAction, IDLE);
  const [editing, setEditing] = useState<string | null>(null);

  if (!session) return null;

  const activeFees = session.fees.filter((fee) => fee.active);
  const inactiveFees = session.fees.filter((fee) => !fee.active);
  const configuredLevels = new Set(activeFees.map((fee) => fee.level));
  const missingLevels = LEVEL_CODES.filter((level) => !configuredLevels.has(level));

  return (
    <div className="space-y-4">
      {sessions.length > 1 ? (
        <nav aria-label="Academic sessions" className="flex flex-wrap gap-2">
          {sessions.map((item) => (
            <Link
              key={item.id}
              href={`/admin/fees?sessionId=${item.id}`}
              aria-current={item.id === session.id ? "page" : undefined}
              className={`inline-flex min-h-[38px] items-center rounded-lg border px-3 text-[13px] font-semibold ${
                item.id === session.id
                  ? "border-pine-700 bg-pine-700 text-white"
                  : "border-line bg-white text-ink hover:border-ink/30"
              }`}
            >
              {item.name}
              {item.active ? (
                <span className="ml-1.5 text-[10.5px] font-bold uppercase opacity-80">Active</span>
              ) : null}
            </Link>
          ))}
        </nav>
      ) : null}

      <Feedback state={updateState} />
      <Feedback state={toggleState} />

      <section className="rounded-2xl border border-line bg-white shadow-soft">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight text-ink">{session.name}</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              {activeFees.length} of {LEVEL_CODES.length} levels configured
              {session.active ? " · students can pay for this session" : " · session not active"}
            </p>
          </div>
        </header>

        <div className="divide-y divide-line">
          {activeFees.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13.5px] text-muted">
              No dues configured for this session yet.
            </p>
          ) : (
            activeFees.map((fee) => (
              <div key={fee.id} className="px-5 py-4">
                {editing === fee.id ? (
                  <form action={update} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="csrf" value={csrf} />
                    <input type="hidden" name="id" value={fee.id} />

                    <div className="w-20">
                      <span className="block text-[11.5px] text-muted">Level</span>
                      <span className="text-[15px] font-bold text-ink">
                        {levelLabel(fee.level as LevelCode)}
                      </span>
                    </div>

                    <div className="min-w-[180px] flex-1">
                      <label
                        htmlFor={`name-${fee.id}`}
                        className="block text-[11.5px] font-semibold text-muted"
                      >
                        Fee name
                      </label>
                      <input
                        id={`name-${fee.id}`}
                        name="name"
                        defaultValue={fee.name}
                        required
                        className="mt-1 min-h-[40px] w-full rounded-lg border border-line px-3 text-[13.5px] text-ink outline-none focus:border-pine-600"
                      />
                    </div>

                    <div className="w-40">
                      <label
                        htmlFor={`amount-${fee.id}`}
                        className="block text-[11.5px] font-semibold text-muted"
                      >
                        Amount (₦)
                      </label>
                      <input
                        id={`amount-${fee.id}`}
                        name="amount"
                        inputMode="decimal"
                        defaultValue={minorToMajorString(fee.amount).replace(/\.00$/, "")}
                        required
                        className="mt-1 min-h-[40px] w-full rounded-lg border border-line px-3 text-[13.5px] tabular-nums text-ink outline-none focus:border-pine-600"
                      />
                    </div>

                    <div className="flex gap-2">
                      <SubmitButton idle="Save" busy="Saving…" />
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="min-h-[40px] rounded-lg border border-line px-3 text-[13px] font-semibold text-ink hover:border-ink/30"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <span className="w-14 text-[15px] font-bold text-ink">
                        {levelLabel(fee.level as LevelCode)}
                      </span>
                      <div>
                        <p className="text-[13.5px] font-medium text-ink">{fee.name}</p>
                        <p className="text-[12px] text-muted">
                          <span className="inline-flex items-center gap-1.5">
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-pine-600" />
                            Active
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-[17px] font-bold tabular-nums text-ink">
                        {formatMoney(fee.amount, fee.currency)}
                      </span>
                      {canWrite ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditing(fee.id)}
                            className="min-h-[36px] rounded-lg border border-line px-3 text-[12.5px] font-semibold text-ink hover:border-ink/30"
                          >
                            Edit
                          </button>
                          <form action={toggle}>
                            <input type="hidden" name="csrf" value={csrf} />
                            <input type="hidden" name="id" value={fee.id} />
                            <input type="hidden" name="active" value="false" />
                            <SmallSubmit idle="Deactivate" busy="…" />
                          </form>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {canWrite && missingLevels.length > 0 ? (
        <section className="rounded-2xl border border-line bg-white shadow-soft">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-bold tracking-tight text-ink">Add dues for a level</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              Levels without an active amount: {missingLevels.map((l) => levelLabel(l)).join(", ")}
            </p>
          </header>

          <div className="p-5">
            <Feedback state={createState} />

            <form action={create} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="csrf" value={csrf} />
              <input type="hidden" name="sessionId" value={session.id} />

              <div className="w-32">
                <label htmlFor="new-level" className="block text-[11.5px] font-semibold text-muted">
                  Level
                </label>
                <select
                  id="new-level"
                  name="level"
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-line bg-white px-3 text-[13.5px] text-ink outline-none focus:border-pine-600"
                >
                  {missingLevels.map((level) => (
                    <option key={level} value={level}>
                      {levelLabel(level)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[200px] flex-1">
                <label htmlFor="new-name" className="block text-[11.5px] font-semibold text-muted">
                  Fee name
                </label>
                <input
                  id="new-name"
                  name="name"
                  defaultValue="COLBIOS Dues"
                  required
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-line px-3 text-[13.5px] text-ink outline-none focus:border-pine-600"
                />
              </div>

              <div className="w-40">
                <label htmlFor="new-amount" className="block text-[11.5px] font-semibold text-muted">
                  Amount (₦)
                </label>
                <input
                  id="new-amount"
                  name="amount"
                  inputMode="decimal"
                  placeholder="5000"
                  required
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-line px-3 text-[13.5px] tabular-nums text-ink outline-none focus:border-pine-600"
                />
              </div>

              <SubmitButton idle="Add dues" busy="Adding…" />
            </form>
          </div>
        </section>
      ) : null}

      {inactiveFees.length > 0 ? (
        <section className="rounded-2xl border border-line bg-white shadow-soft">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-bold tracking-tight text-ink">Inactive dues</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              Kept for the record. Historical payments still reference them.
            </p>
          </header>
          <div className="divide-y divide-line">
            {inactiveFees.map((fee) => (
              <div key={fee.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span className="text-[13.5px] text-muted">
                  <span className="font-semibold text-ink">{levelLabel(fee.level as LevelCode)}</span>{" "}
                  · {fee.name} · {formatMoney(fee.amount, fee.currency)}
                </span>
                {canWrite ? (
                  <form action={toggle}>
                    <input type="hidden" name="csrf" value={csrf} />
                    <input type="hidden" name="id" value={fee.id} />
                    <input type="hidden" name="active" value="true" />
                    <SmallSubmit idle="Reactivate" busy="…" />
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!canWrite ? (
        <p className="text-[12.5px] text-muted">
          Your role can view fees but not change them. Fee changes require the Finance or Super
          administrator role.
        </p>
      ) : null}
    </div>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (!state.error && !state.success) return null;
  return (
    <div role="status" aria-live="polite" className="mb-3">
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

function SubmitButton({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-pine-700 px-4 text-[13px] font-semibold text-white hover:bg-pine-800 disabled:opacity-60"
    >
      {pending ? busy : idle}
    </button>
  );
}

function SmallSubmit({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[36px] items-center rounded-lg border border-line px-3 text-[12.5px] font-semibold text-ink hover:border-ink/30 disabled:opacity-60"
    >
      {pending ? busy : idle}
    </button>
  );
}
