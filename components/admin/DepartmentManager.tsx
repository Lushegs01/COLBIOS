"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  IDLE,
  createDepartmentAction,
  updateDepartmentAction,
} from "@/app/admin/(dashboard)/departments/actions";
import type { ActionState } from "@/app/admin/(dashboard)/payments/actions";

type DepartmentRow = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  paymentCount: number;
};

export default function DepartmentManager({
  departments,
  canWrite,
  csrf,
}: {
  departments: DepartmentRow[];
  canWrite: boolean;
  csrf: string;
}) {
  const [createState, create] = useActionState<ActionState, FormData>(createDepartmentAction, IDLE);
  const [updateState, update] = useActionState<ActionState, FormData>(updateDepartmentAction, IDLE);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Feedback state={updateState} />

      <section className="rounded-2xl border border-line bg-white shadow-soft">
        <header className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-bold tracking-tight text-ink">Departments</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Students choose from the active departments here. Deactivating one hides it from the
            payment form without touching existing payments.
          </p>
        </header>

        <div className="divide-y divide-line">
          {departments.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13.5px] text-muted">No departments yet.</p>
          ) : (
            departments.map((department) => (
              <div key={department.id} className="px-5 py-4">
                {editing === department.id ? (
                  <form action={update} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="csrf" value={csrf} />
                    <input type="hidden" name="id" value={department.id} />

                    <div className="min-w-[200px] flex-1">
                      <label
                        htmlFor={`name-${department.id}`}
                        className="block text-[11.5px] font-semibold text-muted"
                      >
                        Name
                      </label>
                      <input
                        id={`name-${department.id}`}
                        name="name"
                        defaultValue={department.name}
                        required
                        className="mt-1 min-h-[40px] w-full rounded-lg border border-line px-3 text-[13.5px] text-ink outline-none focus:border-pine-600"
                      />
                    </div>

                    <div className="w-32">
                      <label
                        htmlFor={`code-${department.id}`}
                        className="block text-[11.5px] font-semibold text-muted"
                      >
                        Code
                      </label>
                      <input
                        id={`code-${department.id}`}
                        name="code"
                        defaultValue={department.code}
                        required
                        className="mt-1 min-h-[40px] w-full rounded-lg border border-line px-3 font-mono text-[13px] uppercase text-ink outline-none focus:border-pine-600"
                      />
                    </div>

                    <div className="w-36">
                      <label
                        htmlFor={`active-${department.id}`}
                        className="block text-[11.5px] font-semibold text-muted"
                      >
                        Status
                      </label>
                      <select
                        id={`active-${department.id}`}
                        name="active"
                        defaultValue={String(department.active)}
                        className="mt-1 min-h-[40px] w-full rounded-lg border border-line bg-white px-3 text-[13.5px] text-ink outline-none focus:border-pine-600"
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
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
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-[14px] font-semibold text-ink">{department.name}</h3>
                        <span className="rounded border border-line bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted">
                          {department.code}
                        </span>
                        {!department.active ? (
                          <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-bold text-muted">
                            INACTIVE
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {department.paymentCount.toLocaleString("en-NG")}{" "}
                        {department.paymentCount === 1 ? "payment" : "payments"} recorded
                      </p>
                    </div>

                    {canWrite ? (
                      <button
                        type="button"
                        onClick={() => setEditing(department.id)}
                        className="min-h-[36px] rounded-lg border border-line px-3 text-[12.5px] font-semibold text-ink hover:border-ink/30"
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {canWrite ? (
        <section className="rounded-2xl border border-line bg-white shadow-soft">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-bold tracking-tight text-ink">Add a department</h2>
          </header>
          <div className="p-5">
            <Feedback state={createState} />
            <form action={create} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="csrf" value={csrf} />

              <div className="min-w-[220px] flex-1">
                <label htmlFor="new-department" className="block text-[11.5px] font-semibold text-muted">
                  Name
                </label>
                <input
                  id="new-department"
                  name="name"
                  placeholder="Biochemistry"
                  required
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-line px-3 text-[13.5px] text-ink outline-none focus:border-pine-600"
                />
              </div>

              <div className="w-32">
                <label htmlFor="new-code" className="block text-[11.5px] font-semibold text-muted">
                  Code
                </label>
                <input
                  id="new-code"
                  name="code"
                  placeholder="BCH"
                  required
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-line px-3 font-mono text-[13px] uppercase text-ink outline-none focus:border-pine-600"
                />
              </div>

              <SubmitButton idle="Add department" busy="Adding…" />
            </form>
          </div>
        </section>
      ) : (
        <p className="text-[12.5px] text-muted">Your role can view departments but not change them.</p>
      )}
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
