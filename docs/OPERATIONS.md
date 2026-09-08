# Operations runbook

For whoever runs COLBIOS dues collection day to day. No code knowledge assumed.

---

## Roles

| Role | Can do |
| --- | --- |
| **Super administrator** | Everything, including creating and deactivating administrator accounts |
| **Administrator** | Sessions, departments, payments, reports, audit log |
| **Finance** | Payments, fees, refunds, manual adjustments, reports |

Permissions are enforced on the server for every page and action. A hidden menu
item is not a permission; typing the URL will not get anyone further.

---

## Opening a new academic session

1. **Sessions → Create a session** (e.g. `2027/2028`). It starts inactive.
2. **Fees** → pick the new session and set the amount for each level.
3. **Sessions → Activate.** Activation is refused if no level has a fee.

Activating a session deactivates the previous one automatically — only one
session can be open at a time, and the database enforces that.

Students who paid for an earlier session keep their receipts; changing sessions
never touches historical records.

## Changing what a level pays

**Fees → Edit.** The change applies to *new* payments only. Every payment stores
the amount it was charged, so an already-issued receipt keeps its amount. The
change is recorded in the audit log with the old and new values and who made it.

To stop a level paying entirely, **Deactivate** its fee. Students at that level
then see "dues have not been set for your level" instead of a broken checkout.

---

## A student says they paid but their payment is not showing

1. **Payments** → search their matric number or reference.
2. Open the payment and press **Re-check with Paystack**. This asks Paystack
   directly and applies the answer. Most stuck payments resolve here.
3. If Paystack says the transaction did not succeed, the student was not
   charged; ask them to try again.
4. If Paystack says it succeeded but the amount does not match, **stop** and
   escalate — see below.

Never tell a student to pay again just because the page says pending. Check
first: a duplicate charge is much harder to undo than a delay.

## A payment shows an amount mismatch

This means the amount Paystack reports differs from the dues configured for that
student's level. The payment is deliberately left unfulfilled.

1. Look up the transaction in the Paystack dashboard and note the real amount.
2. Check whether the fee was changed while the student was at checkout (the
   audit log will show it).
3. If the student underpaid, ask them to pay the difference through the college
   office and record it as a manual adjustment (below), or refund and ask them
   to start again.
4. If they overpaid, refund the difference from the Paystack dashboard and
   record the refund here.

The application logs `payment_amount_mismatch` for every occurrence.

---

## Recording a payment made outside Paystack

Sometimes a student pays by bank transfer to the college account. That can be
recorded, but it is a controlled action:

**Payments → the payment → Record an offline payment**

You must give a full written reason (at least 20 characters — write the teller
number or statement reference) and type `CONFIRM`. The result is a payment
marked **manual adjustment**, visible as such in the payment list, on the
receipt, and on the public verification page. No Paystack transaction id is
invented.

Only Finance and Super administrator roles can do this, and it is permanently
recorded in the audit log with your name and the time.

## Recording a refund or reversal

Refunds are issued in the **Paystack dashboard** — this application does not
move money. After refunding there, record it here so the student's dues status
and the college's totals stay truthful:

**Payments → the payment → Record a refund or reversal**, with a reason.

The student's dues become outstanding again and they can pay afresh.

---

## Reports and reconciliation

**Reports** gives totals collected and expected, transaction counts by status,
and breakdowns by level, department, channel and date, filterable by session and
date range.

- **Export summary CSV** — the figures above, for a finance report.
- **Export payments CSV** — one row per payment, for reconciling against the
  Paystack settlement report.

Both are generated on the server and recorded in the audit log, because an
export takes student data out of the system.

To reconcile a settlement: export payments for the date range, filter to
`SUCCESS`, and compare the total against the Paystack settlement. Manual
adjustments are flagged in their own column — they will not appear in Paystack's
figures, which is exactly why they are flagged.

---

## What the audit log records

Every financially significant action: fee creation and changes (with old and new
amounts), session activation, department changes, manual adjustments, refunds,
exports, administrator account changes, and sign-ins including failures.

Entries cannot be edited or deleted from the application. Passwords, keys and
tokens are never recorded — the trail shows *that* a password changed, never
what it changed to.

---

## Administrator accounts

**Settings → Administrators.** Create accounts with the smallest role that fits
the job. Deactivate rather than sharing logins; a deactivated account loses
access on its next request, not when its session expires.

The application refuses to deactivate the last active super administrator.

Change your own password under **Settings → Change your password**; you will be
signed out and asked to sign in again.

---

## Reading the logs

One JSON line per event. Worth watching:

| Event | Meaning |
| --- | --- |
| `payment_amount_mismatch` | Investigate — see above |
| `webhook_signature_invalid` | Someone is posting unsigned requests to the webhook |
| `webhook_processing_failed` | A delivery failed; Paystack retries and the reason is on the event row |
| `duplicate_webhook_ignored` | Normal — a Paystack retry that was correctly ignored |
| `email_failed` | The receipt email did not send; the payment is unaffected |
| `admin_login_failed` | Failed sign-in; repeated entries mean someone is guessing |

---

## If the site is down

Payments already completed are safe — they are recorded in the database and
Paystack has its own record. A student who paid during an outage is settled by
the webhook when service returns, because Paystack retries failed deliveries.

1. Check the Vercel deployment status and the database provider's status page.
2. Check **Settings → Configuration** once the site responds.
3. For payments made during the outage, use **Re-check with Paystack** on each,
   or wait for Paystack's retries.
