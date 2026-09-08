# COLBIOS Dues

The dues payment platform for the College of Biosciences, Federal University of
Agriculture, Abeokuta. Students pay their college dues online with Paystack and
get a verifiable receipt; the college configures what each level pays and
reconciles collections from an administrative dashboard.

Built with Next.js 16 (App Router), TypeScript, PostgreSQL/Prisma and Paystack.

---

## How it works

```
Student enters details          Server decides what they owe
  name, matric, email  ─────►   active session → fee for their level → amount
  department, level                          │
                                             ▼
                              Payment created PENDING with a server reference
                                             │
                                             ▼
                                   Paystack checkout (real)
                                             │
                    ┌────────────────────────┴───────────────────────┐
                    ▼                                                ▼
        Browser returns to /pay/callback                  Paystack webhook
                    │                                                │
                    └──────────────► server asks Paystack ◄──────────┘
                                     "what really happened?"
                                             │
                          amount + currency + reference all match?
                                             │
                                             ▼
                        one transaction: SUCCESS + receipt + email
```

Two things are worth stating plainly, because they are the whole point:

**The browser never decides the amount.** The payment form submits identity
fields only — there is no `amount` field in the request schema. The server reads
the active session, finds the active fee for the student's level, and sends
*that* amount to Paystack.

**Returning from checkout proves nothing.** A payment becomes `SUCCESS` only
after the server has asked Paystack directly and the reference, amount and
currency all match what was stored when the payment was created. The callback
page and the webhook both go through the same verification; whichever arrives
first wins, and the other becomes a no-op.

---

## Quick start

Requirements: Node 20.9+, PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL and the Paystack test keys
npm run db:migrate            # create the schema
npm run db:seed               # sample departments, session and fees (development only)
npm run admin:bootstrap       # create the first administrator, interactively
npm run dev
```

Then open <http://localhost:3000/pay> to pay as a student, and
<http://localhost:3000/admin> to sign in as an administrator.

### Working without Paystack

A local stand-in implements the two endpoints this application calls, plus
controls for completing, failing and webhooking a transaction:

```bash
npm run mock:paystack                                   # terminal 1
PAYSTACK_BASE_URL=http://127.0.0.1:4010 npm run dev     # terminal 2

# then, with a reference from a started payment:
curl -X POST http://127.0.0.1:4010/_control/pay/COLBIOS-2026-XXXXXXXX
curl -X POST http://127.0.0.1:4010/_control/webhook/COLBIOS-2026-XXXXXXXX
```

`PAYSTACK_BASE_URL` is ignored when `NODE_ENV=production`, so a production
deployment always talks to Paystack itself.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | `prisma generate` + production build |
| `npm start` | Production server |
| `npm test` | Full test suite (needs a database whose name contains `test`) |
| `npm run typecheck` | TypeScript, strict mode |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Insert clearly-labelled sample data (development only) |
| `npm run db:studio` | Prisma Studio |
| `npm run admin:bootstrap` | Create an administrator account |
| `npm run mock:paystack` | Local Paystack stand-in |

---

## Routes

**Public**

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/pay` | Payment form: details → review → Paystack |
| `/pay/callback` | Where Paystack returns the browser; runs server-side verification |
| `/payment/success`, `/payment/pending`, `/payment/failed` | Outcome pages |
| `/receipt/[reference]` | Receipt, with print and PDF |
| `/receipt/[reference]/pdf` | Receipt PDF (generated on demand) |
| `/verify/[reference]` | Public verification — what the receipt's QR code points to |

**API**

| Route | Purpose |
| --- | --- |
| `POST /api/payments/quote` | What this student owes (creates nothing) |
| `POST /api/payments/initialize` | Create the payment, start Paystack checkout |
| `POST /api/payments/verify` | Verify a reference against Paystack and apply the result |
| `POST /api/payments/webhook` | Paystack's authoritative fulfilment channel |
| `GET/POST /api/admin/fees`, `/sessions`, `/departments` | Configuration |
| `GET /api/admin/payments`, `/payments/export` | Payment search and CSV export |
| `GET /api/admin/reports`, `/reports/export` | Aggregates and summary CSV |

**Admin** — `/admin`, `/admin/login`, `/admin/payments[/id]`, `/admin/students`,
`/admin/fees`, `/admin/sessions`, `/admin/departments`, `/admin/reports`,
`/admin/audit-logs`, `/admin/settings`.

Every admin page and API route runs its own authorization check and re-reads the
account from the database. Hiding a navigation link is never the protection.

---

## Project structure

```
app/
  api/payments/…        public payment endpoints
  api/admin/…           admin JSON endpoints and CSV exports
  pay/, payment/…       student flow
  receipt/, verify/…    receipts and public verification
  admin/(dashboard)/…   authenticated admin area (own layout + guard)
components/
  pay/, admin/, ui/     the only client components are forms and one print button
lib/
  db/                   Prisma client
  payments/             fee resolution, references, state machine, fulfilment, webhooks
  paystack/             HTTP client, signature verification, types
  auth/                 sessions, password hashing, permission guards
  validation/           Zod schemas — the only entry point for outside data
  rate-limit/           durable, database-backed limiter
  email/                Resend delivery, exactly-once dispatch
  receipts/             receipt numbering, PDF, QR
  audit/                administrative audit trail
  admin/                analytics, payment search, CSV
prisma/                 schema, migrations, seed
tests/                  unit and integration suites
```

---

## How money is handled

Amounts are integers in the currency's minor unit — kobo for NGN — everywhere:
in the database, in this codebase, and on the wire to Paystack. ₦5,000 is
`500000`. A float never touches a monetary value; admin input is parsed from the
*string* so `5000.10` cannot become `5000.099999`.

Each payment stores a snapshot of the fee, session and department it was made
against. Changing a fee tomorrow never rewrites a receipt issued today.

---

## What the database guarantees

Some invariants are too important to leave to application code, so they are
enforced by PostgreSQL and cannot be bypassed even by a bug or a direct write
(see the partial unique indexes in `prisma/migrations/*/migration.sql`):

- at most one active academic session;
- at most one active fee per session + level + fee type;
- **at most one `SUCCESS` payment per matric number + session + fee** — the hard
  duplicate-payment guard;
- one receipt per payment, and globally unique payment references, receipt
  numbers and provider transaction ids.

Fulfilment happens inside a transaction that takes a row lock on the payment, so
a webhook and a callback arriving together serialise: one writes the status
change and the receipt, the other sees the finished payment and returns it.

---

## Security

- Webhook signatures verified as HMAC-SHA512 over the **raw** request body, with
  a constant-time comparison.
- Webhook idempotency through a unique provider event id; duplicate deliveries
  are acknowledged, not reprocessed.
- Administrator sessions are signed JWTs in `HttpOnly`, `Secure`, `SameSite=Lax`
  cookies; passwords are bcrypt (cost 12); mutations carry a double-submit CSRF
  token.
- Rate limiting on payment initialization, verification, public lookups and
  sign-in — stored in PostgreSQL so it holds across serverless instances, and
  keyed by a hash so raw IP addresses are never stored.
- Content-Security-Policy with a per-request nonce on the payment and admin
  surfaces, plus HSTS, `X-Frame-Options`, `X-Content-Type-Options` and
  `Referrer-Policy` site-wide.
- Structured JSON logging with automatic redaction — a key, password or database
  URL cannot reach the logs.
- Students never see an exception message, a Prisma error or a stack trace.
- Secrets are read only through `lib/env.ts`, which is `server-only`.

## Testing

```bash
createdb colbios_test
TEST_DATABASE_URL="postgresql://postgres@127.0.0.1:5432/colbios_test" npm test
```

168 tests. The integration suite runs against a real PostgreSQL database — the
partial unique indexes, row locking and transactional fulfilment are exercised
for real, with only the Paystack HTTP boundary replaced. It covers duplicate
webhooks, callback-before-webhook and webhook-before-callback ordering, amount
and currency mismatches, concurrent fulfilment, already-paid students, receipt
numbering, rate limits and admin authorization.

The runner refuses to start unless the database name contains `test`, because it
truncates every table.

---

## Deployment

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for Vercel and database setup,
and **[docs/PAYSTACK.md](docs/PAYSTACK.md)** for the webhook configuration and
the test-mode → live-mode switch. **[docs/OPERATIONS.md](docs/OPERATIONS.md)** is
the runbook for the finance office: stuck payments, reconciliation, refunds and
what the audit log records.
