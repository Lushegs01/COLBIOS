"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  IDLE_STATE,
  manualAdjustmentAction,
  refundAction,
  reverifyPaymentAction,
  type ActionState,
} from "@/app/admin/(dashboard)/payments/actions";
import type { PaymentStatusValue } from "@/lib/payments/state";

/**
 * The administrative controls on a payment.
 *
 * "Record an offline payment" is intentionally awkward to use: it is collapsed
 * behind a disclosure, demands a written reason and a typed confirmation, and
 * states in the interface that it does not create a Paystack transaction. The
 * server enforces every one of those rules again — this component only makes
 * the consequences visible.
 */
export default function PaymentAdminActions({
  paymentId,
  reference,
  status,
  csrf,
  canAdjust,
}: {
  paymentId: string;
  reference: string;
  status: PaymentStatusValue;
  csrf: string;
  canAdjust: boolean;
}) {
  const [verifyState, verify] = useActionState<ActionState, FormData>(
    reverifyPaymentAction,
    IDLE_STATE,
  );
  const [adjustState, adjust] = useActionState<ActionState, FormData>(
    manualAdjustmentAction,
    IDLE_STATE,
  );
  const [refundState, refund] = useActionState<ActionState, FormData>(refundAction, IDLE_STATE);

  const [showAdjust, setShowAdjust] = useState(false);
  const [showRefund, setShowRefund] = useState(false);

  const canRecordOffline = canAdjust && ["PENDING", "FAILED", "ABANDONED"].includes(status);
  const canRefund = canAdjust && status === "SUCCESS";

  return (
    <section className="rounded-2xl border border-line bg-white shadow-soft">
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-[15px] font-bold tracking-tight text-ink">Actions</h2>
        <p className="mt-0.5 text-[12.5px] text-muted">Every action here is recorded in the audit log.</p>
      </header>

      <div className="space-y-4 p-5">
        <Feedback state={verifyState} />

        <form action={verify}>
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="reference" value={reference} />
          <SubmitButton idle="Re-check with Paystack" busy="Checking…" variant="secondary" />
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
            Asks Paystack again what happened to this reference and applies the answer.
          </p>
        </form>

        {canRecordOffline ? (
          <div className="border-t border-line pt-4">
            <Feedback state={adjustState} />

            {!showAdjust ? (
              <button
                type="button"
                onClick={() => setShowAdjust(true)}
                className="min-h-[40px] w-full rounded-lg border border-amber-300 bg-amber-50 px-3 text-[13px] font-semibold text-amber-900 hover:bg-amber-100"
              >
                Record an offline payment…
              </button>
            ) : (
              <form action={adjust} className="space-y-3">
                <input type="hidden" name="csrf" value={csrf} />
                <input type="hidden" name="paymentId" value={paymentId} />

                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[12.5px] leading-relaxed text-amber-900">
                  This records money the college received <strong>outside Paystack</strong>. It does
                  not create a Paystack transaction, and the receipt will say so. Use it only when
                  you have confirmed the funds yourself.
                </div>

                <div>
                  <label htmlFor="reason" className="block text-[12.5px] font-semibold text-ink">
                    Reason (permanently recorded)
                  </label>
                  <textarea
                    id="reason"
                    name="reason"
                    rows={3}
                    minLength={20}
                    required
                    placeholder="e.g. Bank transfer received on 12 March, confirmed against college account statement, teller no. 4821."
                    className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-[13.5px] text-ink outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/20"
                  />
                </div>

                <div>
                  <label htmlFor="confirmation" className="block text-[12.5px] font-semibold text-ink">
                    Type CONFIRM to proceed
                  </label>
                  <input
                    id="confirmation"
                    name="confirmation"
                    required
                    autoComplete="off"
                    className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 font-mono text-[13.5px] text-ink outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/20"
                  />
                </div>

                <div className="flex gap-2">
                  <SubmitButton idle="Record adjustment" busy="Recording…" variant="danger" />
                  <button
                    type="button"
                    onClick={() => setShowAdjust(false)}
                    className="min-h-[40px] rounded-lg border border-line px-3 text-[13px] font-semibold text-ink hover:border-ink/30"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : null}

        {canRefund ? (
          <div className="border-t border-line pt-4">
            <Feedback state={refundState} />

            {!showRefund ? (
              <button
                type="button"
                onClick={() => setShowRefund(true)}
                className="min-h-[40px] w-full rounded-lg border border-line px-3 text-[13px] font-semibold text-ink hover:border-ink/30"
              >
                Record a refund or reversal…
              </button>
            ) : (
              <form action={refund} className="space-y-3">
                <input type="hidden" name="csrf" value={csrf} />
                <input type="hidden" name="paymentId" value={paymentId} />

                <div>
                  <label htmlFor="status" className="block text-[12.5px] font-semibold text-ink">
                    Outcome
                  </label>
                  <select
                    id="status"
                    name="status"
                    className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-[13.5px] text-ink outline-none focus:border-pine-600"
                  >
                    <option value="REFUNDED">Refunded to the student</option>
                    <option value="REVERSED">Reversed by the provider</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="refund-reason" className="block text-[12.5px] font-semibold text-ink">
                    Reason (permanently recorded)
                  </label>
                  <textarea
                    id="refund-reason"
                    name="reason"
                    rows={3}
                    minLength={20}
                    required
                    className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-[13.5px] text-ink outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/20"
                  />
                </div>

                <div className="flex gap-2">
                  <SubmitButton idle="Record outcome" busy="Recording…" variant="danger" />
                  <button
                    type="button"
                    onClick={() => setShowRefund(false)}
                    className="min-h-[40px] rounded-lg border border-line px-3 text-[13px] font-semibold text-ink hover:border-ink/30"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : null}

        {!canAdjust ? (
          <p className="border-t border-line pt-4 text-[12px] leading-relaxed text-muted">
            Recording offline payments and refunds requires the Finance or Super administrator role.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (!state.error && !state.success) return null;
  return (
    <div role="status" aria-live="polite" className="mb-3">
      <p
        className={`rounded-lg border px-3 py-2 text-[12.5px] font-medium ${
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
  variant: "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  const styles =
    variant === "danger"
      ? "bg-red-700 text-white hover:bg-red-800"
      : "border border-line bg-white text-ink hover:border-ink/30";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg px-3 text-[13px] font-semibold transition-colors disabled:opacity-60 ${styles}`}
    >
      {pending ? busy : idle}
    </button>
  );
}
