# Deployment

Target: **Vercel** + **managed PostgreSQL** + **Paystack**.

Work through this in order. Steps 1–5 get a working test-mode deployment; step 8
is the switch to live money, which should only happen after institutional
approval.

---

## 1. Provision the database

Any managed PostgreSQL 14+ works — Neon, Supabase, Railway, RDS. Create a
database and keep two URLs to hand:

- the **pooled** URL, for the application (`DATABASE_URL`);
- the **direct** URL, for migrations, if the provider fronts the database with a
  connection pooler.

On serverless, prefer the pooled endpoint for the app: each function instance
opens its own connections, and an unpooled database will run out.

## 2. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**. Set them
for Production and Preview separately — a preview deployment must never point at
the production database or live Paystack keys.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Pooled connection string |
| `PAYSTACK_SECRET_KEY` | yes | `sk_test_…` first; `sk_live_…` only at go-live |
| `PAYSTACK_PUBLIC_KEY` | yes | Matching public key |
| `NEXTAUTH_SECRET` | yes | ≥32 chars — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | yes | e.g. `https://dues.colbios.edu.ng` |
| `NEXT_PUBLIC_APP_URL` | yes | Same URL — receipt and QR links are built from it |
| `RESEND_API_KEY` | no | Omit and confirmation emails are skipped, nothing else changes |
| `FROM_EMAIL` | no | Must be a domain verified in Resend |

Never set `PAYSTACK_BASE_URL` in production. It is ignored there by design, but
setting it signals confusion about which provider is being called.

## 3. Run the migrations

Migrations are deliberately **not** run automatically on deploy: an
automatically-applied migration during a rollback is how production data gets
damaged. Run them yourself, against the direct (non-pooled) URL:

```bash
DATABASE_URL="<direct-url>" npx prisma migrate deploy
```

Confirm the invariants landed — these are what stop a student paying twice:

```bash
psql "<direct-url>" -c '\di' | grep -E 'single_active|active_session_level_code|success_matric'
```

You should see `AcademicSession_single_active_idx`,
`Fee_active_session_level_code_key` and
`Payment_success_matric_session_fee_key`.

## 4. Deploy

Push to the branch Vercel builds, or `vercel --prod`. The build runs
`prisma generate && next build`; `postinstall` also runs `prisma generate` so the
client exists on a cold clone.

Node 20.9+ is required. Vercel's default is fine.

## 5. Create the first administrator

There are no default credentials anywhere in this codebase. Create the first
account from your own machine, pointed at the production database:

```bash
DATABASE_URL="<direct-url>" npm run admin:bootstrap
```

It prompts for email, name and password, enforces the password policy, refuses
placeholder addresses, and makes the first account a `SUPER_ADMIN`. Further
accounts are created in the dashboard under **Settings**.

## 6. Configure the college's real data

Sign in at `/admin` and, in this order:

1. **Sessions** — create the academic session (e.g. `2026/2027`).
2. **Departments** — add the college's departments. Students pick from this list.
3. **Fees** — set the real dues for each level. *Do not run the seed script
   against production*; its amounts are placeholders and are labelled as such.
4. **Sessions** — activate the session. Activation is refused until at least one
   level has an active fee, so students can never reach a dead end.

Until a session is active, `/pay` tells students payment is not open rather than
failing.

## 7. Configure the Paystack webhook

See **[PAYSTACK.md](PAYSTACK.md)**. In short: set the webhook URL in the Paystack
dashboard to

```
https://YOUR-DOMAIN/api/payments/webhook
```

and confirm a test payment produces a `PaymentEvent` row.

## 8. Going live

Only after institutional approval and a completed Paystack business
verification:

1. Replace `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` with the live keys.
2. Set the **live** webhook URL in the Paystack dashboard (test and live have
   separate webhook settings).
3. Redeploy so the new keys are picked up.
4. Make one small real payment end to end, confirm the receipt and the
   verification page, then refund it from the Paystack dashboard and record the
   refund in **Payments → the payment → Record a refund**.

**Settings → Configuration** in the dashboard shows whether the deployment is in
test or live mode, whether a session and fees are configured, and whether email
is set up. Check it after every environment change.

---

## Monitoring

The application writes one JSON object per line to stdout, which Vercel
collects. Useful queries:

| Look for | Meaning |
| --- | --- |
| `"event":"payment_verified"` | A payment completed |
| `"event":"payment_amount_mismatch"` | **Investigate immediately** — a provider amount did not match the stored one |
| `"event":"webhook_signature_invalid"` | Something is posting unsigned bodies to the webhook |
| `"event":"webhook_processing_failed"` | A delivery failed; Paystack will retry, and the `PaymentEvent` row holds the reason |
| `"event":"duplicate_webhook_ignored"` | Normal — Paystack retried a delivery |
| `"event":"rate_limited"` | A client hit a limit |
| `"event":"email_failed"` | Delivery failed; the payment is unaffected and will retry on the next verification |

Secrets are redacted before anything is written, so these lines are safe to ship
to an external log service.

For error tracking, add Sentry (`@sentry/nextjs`) — the error boundary in
`app/error.tsx` already shows users a digest rather than an exception, so the
only change needed is reporting.

---

## Backups and recovery

- Enable point-in-time recovery on the database. Payment records are the
  college's financial record; nothing else in this system is irreplaceable.
- `PaymentEvent` retains every provider event body, so a payment can be
  reconstructed from provider data if needed.
- Receipts are generated on demand from the payment record, not stored as files,
  so there is nothing else to back up.

---

## Dependency security

`npm audit` should report **zero** vulnerabilities. If it does not, treat it as
a release blocker and investigate before deploying — this application handles
money.

Two transitive packages are currently pinned forward in `overrides` in
`package.json`:

| Package | Why it is here | Why it is pinned |
| --- | --- | --- |
| `mysql2` | `@prisma/client` depends on the `prisma` CLI, which bundles drivers for every database Prisma supports | Advisories on credential leakage and a decompression-bomb DoS. This app uses PostgreSQL and never loads `mysql2`, but leaving a flagged package in the production tree hides real findings behind noise. |
| `deepmerge-ts` | Used by `@prisma/config` when loading `prisma.config.ts` | Stack exhaustion on recursive object graphs. |

Neither package is imported by application code, so the pins are about keeping
the audit signal clean rather than closing a reachable hole. Remove them once
Prisma ships versions that depend on the patched releases directly — after
removing, run `npm install`, then `npx prisma generate`, `npx prisma migrate
deploy` and the test suite, because both packages sit in Prisma's own
machinery.

---

## Rolling back

Roll back the deployment in Vercel. Do **not** roll back a migration on a
database holding live payments — migrations here are additive; a rollback that
drops a column loses data. If a migration must be undone, write a new forward
migration.
