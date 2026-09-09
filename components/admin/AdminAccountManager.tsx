"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { IDLE, type ActionState } from "@/app/admin/(dashboard)/action-state";
import {
  changePasswordAction,
  createAdminAction,
  toggleAdminAction,
} from "@/app/admin/(dashboard)/settings/actions";

type AdminRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  lastLogin: string;
};

const PASSWORD_RULES =
  "At least 12 characters, with an uppercase letter, a lowercase letter, a number and a symbol.";

export default function AdminAccountManager({
  admins,
  canManageAdmins,
  currentAdminId,
  csrf,
}: {
  admins: AdminRow[];
  canManageAdmins: boolean;
  currentAdminId: string;
  csrf: string;
}) {
  const [createState, create] = useActionState<ActionState, FormData>(createAdminAction, IDLE);
  const [toggleState, toggle] = useActionState<ActionState, FormData>(toggleAdminAction, IDLE);
  const [passwordState, changePassword] = useActionState<ActionState, FormData>(
    changePasswordAction,
    IDLE,
  );
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-line bg-white shadow-soft lg:col-span-2">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight text-ink">Administrators</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              {canManageAdmins
                ? "Only super administrators can create or deactivate accounts."
                : "Only super administrators can see and manage the full account list."}
            </p>
          </div>
          {canManageAdmins ? (
            <button
              type="button"
              onClick={() => setShowCreate((value) => !value)}
              className="inline-flex min-h-[38px] items-center rounded-lg bg-pine-700 px-3 text-[13px] font-semibold text-white hover:bg-pine-800"
            >
              {showCreate ? "Cancel" : "Add administrator"}
            </button>
          ) : null}
        </header>

        {canManageAdmins ? (
          <div className="p-5">
            <Feedback state={toggleState} />

            {showCreate ? (
              <form action={create} className="mb-5 rounded-xl border border-line bg-background p-4">
                <Feedback state={createState} />
                <input type="hidden" name="csrf" value={csrf} />

                <div className="grid gap-3 sm:grid-cols-2">
                  <LabelledInput id="admin-name" name="name" label="Full name" required />
                  <LabelledInput id="admin-email" name="email" label="Email" type="email" required />

                  <div>
                    <label htmlFor="admin-role" className="mb-1 block text-[11.5px] font-semibold text-muted">
                      Role
                    </label>
                    <select
                      id="admin-role"
                      name="role"
                      defaultValue="FINANCE"
                      className="min-h-[40px] w-full rounded-lg border border-line bg-white px-3 text-[13.5px] text-ink outline-none focus:border-pine-600"
                    >
                      <option value="FINANCE">Finance — payments, fees, refunds</option>
                      <option value="ADMIN">Administrator — sessions, departments, reports</option>
                      <option value="SUPER_ADMIN">Super administrator — everything</option>
                    </select>
                  </div>

                  <LabelledInput
                    id="admin-password"
                    name="password"
                    label="Temporary password"
                    type="password"
                    hint={PASSWORD_RULES}
                    required
                  />
                </div>

                <div className="mt-4">
                  <SubmitButton idle="Create account" busy="Creating…" />
                </div>
              </form>
            ) : null}

            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <caption className="sr-only">Administrator accounts</caption>
                <thead>
                  <tr className="border-b border-line text-[11.5px] uppercase tracking-wide text-muted">
                    <th scope="col" className="py-2 pr-3 font-semibold">Name</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Role</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Status</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Last sign-in</th>
                    <th scope="col" className="py-2 font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((account) => (
                    <tr key={account.id} className="border-b border-line/60 last:border-0">
                      <td className="py-2.5 pr-3">
                        <span className="block text-[13.5px] font-medium text-ink">{account.name}</span>
                        <span className="block text-[11.5px] text-muted">{account.email}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-[13px] text-ink">
                        {account.role.replace("_", " ").toLowerCase()}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-bold ${
                            account.active
                              ? "border-pine-200 bg-pine-50 text-pine-800"
                              : "border-line bg-background text-muted"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`h-1.5 w-1.5 rounded-full ${
                              account.active ? "bg-pine-600" : "bg-zinc-400"
                            }`}
                          />
                          {account.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-[12.5px] text-muted">{account.lastLogin}</td>
                      <td className="py-2.5 text-right">
                        {account.id === currentAdminId ? (
                          <span className="text-[12px] text-muted">You</span>
                        ) : (
                          <form action={toggle}>
                            <input type="hidden" name="csrf" value={csrf} />
                            <input type="hidden" name="id" value={account.id} />
                            <input type="hidden" name="active" value={String(!account.active)} />
                            <SmallSubmit idle={account.active ? "Deactivate" : "Reactivate"} busy="…" />
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-line bg-white shadow-soft lg:col-span-2">
        <header className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-bold tracking-tight text-ink">Change your password</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            You will be signed out and asked to sign in again.
          </p>
        </header>
        <div className="p-5">
          <Feedback state={passwordState} />
          <form action={changePassword} className="grid max-w-2xl gap-3 sm:grid-cols-3">
            <input type="hidden" name="csrf" value={csrf} />
            <LabelledInput
              id="currentPassword"
              name="currentPassword"
              label="Current password"
              type="password"
              required
            />
            <LabelledInput
              id="newPassword"
              name="newPassword"
              label="New password"
              type="password"
              hint={PASSWORD_RULES}
              required
            />
            <LabelledInput
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm new password"
              type="password"
              required
            />
            <div className="sm:col-span-3">
              <SubmitButton idle="Change password" busy="Changing…" />
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

function LabelledInput({
  id,
  name,
  label,
  type = "text",
  hint,
  required,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11.5px] font-semibold text-muted">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
        autoComplete={type === "password" ? "new-password" : "off"}
        className="min-h-[40px] w-full rounded-lg border border-line bg-white px-3 text-[13.5px] text-ink outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/20"
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-[11.5px] leading-relaxed text-muted">
          {hint}
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
      className="inline-flex min-h-[34px] items-center rounded-lg border border-line px-3 text-[12.5px] font-semibold text-ink hover:border-ink/30 disabled:opacity-60"
    >
      {pending ? busy : idle}
    </button>
  );
}
