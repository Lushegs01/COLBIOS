# Paystack configuration

Everything here is about wiring, not code. The integration is complete; what
follows is how to point it at a Paystack account.

---

## Keys

Paystack issues two pairs of keys, and they are entirely separate accounts of
record:

| Mode | Keys | Money |
| --- | --- | --- |
| Test | `sk_test_…` / `pk_test_…` | None. Use Paystack's [test cards](https://paystack.com/docs/payments/test-payments/). |
| Live | `sk_live_…` / `pk_live_…` | Real. Requires completed business verification. |

Set `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` from **Dashboard →
Settings → API Keys & Webhooks**. Moving to production is exactly this swap —
no code changes.

The secret key is read in one module (`lib/paystack/client.ts`), which is
`server-only`. It cannot reach the browser bundle.

---

## Webhook

The webhook is the authoritative fulfilment path. Callbacks can be lost — a
student closing the tab, a dropped connection on the way back from checkout —
and the webhook is what settles those payments.

**Set the URL** in **Dashboard → Settings → API Keys & Webhooks → Webhook URL**:

```
https://YOUR-DOMAIN/api/payments/webhook
```

Test mode and live mode have **separate** webhook settings. Setting one does not
set the other; this is the single most common cause of "payments work in test
but not in production".

### What the endpoint does

1. Verifies the `x-paystack-signature` header as HMAC-SHA512 of the **raw**
   request body keyed with the secret key, compared in constant time. An invalid
   signature gets a `400` and touches nothing.
2. Stores the event under a unique id derived from the event type and
   transaction id. A duplicate delivery loses that race and is acknowledged
   without being processed again.
3. **Re-verifies the transaction against Paystack's API.** The webhook body says
   *that* something happened; the API says what is true. The amount in the body
   is never trusted.
4. Checks the reference, amount and currency against the stored payment.
5. Marks the payment `SUCCESS`, issues the receipt and sends the confirmation —
   all inside one database transaction, exactly once.

### Response codes, and why they matter

| Code | When | Paystack's behaviour |
| --- | --- | --- |
| `200` | Processed, duplicate, or an event we do not act on | Stops retrying |
| `400` | Invalid signature or unparseable body | Stops retrying |
| `500` | Genuine processing failure | **Retries** — which is what we want |

### Events handled

| Event | Effect |
| --- | --- |
| `charge.success` | Verify, then fulfil: `SUCCESS` + receipt + email |
| `charge.failed` | Record `FAILED` (never downgrades an already-successful payment) |
| `charge.abandoned` | Record `ABANDONED` |
| `charge.reversed` | Record `REVERSED` |
| `refund.processed` | Record `REFUNDED` |

Anything else is stored and acknowledged.

---

## Testing the webhook locally

`localhost` is not reachable from Paystack, so pick one of these.

**Option A — the built-in mock (no network needed).** Implements the two
endpoints the app calls and can deliver a correctly-signed webhook:

```bash
npm run mock:paystack                                    # terminal 1
PAYSTACK_BASE_URL=http://127.0.0.1:4010 npm run dev      # terminal 2

# start a payment in the browser, then with its reference:
curl -X POST http://127.0.0.1:4010/_control/pay/COLBIOS-2026-XXXXXXXX
curl -X POST http://127.0.0.1:4010/_control/webhook/COLBIOS-2026-XXXXXXXX
```

**Option B — a tunnel to real Paystack test mode.** Closest to production:

```bash
npx localtunnel --port 3000        # or ngrok http 3000
# put https://<tunnel>/api/payments/webhook in the Paystack test webhook setting
```

**Option C — a hand-signed request.** Useful for testing rejection paths:

```bash
BODY='{"event":"charge.success","data":{"id":123,"reference":"COLBIOS-2026-XXXXXXXX"}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha512 -hmac "$PAYSTACK_SECRET_KEY" | awk '{print $2}')
curl -X POST http://localhost:3000/api/payments/webhook \
  -H "Content-Type: application/json" -H "x-paystack-signature: $SIG" -d "$BODY"
```

The signature must be computed over the exact bytes sent. Re-serialising parsed
JSON changes key order and whitespace and will never match — that is deliberate.

---

## What we send to Paystack

```jsonc
{
  "email":        "student@example.com",   // collected on the form; Paystack requires it
  "amount":       600000,                  // kobo, read from the database
  "currency":     "NGN",
  "reference":    "COLBIOS-2026-7F3KQ9AB", // generated server-side, unique in the database
  "callback_url": "https://YOUR-DOMAIN/pay/callback?reference=…",
  "metadata": {
    "paymentId": "…", "feeId": "…", "sessionId": "…", "level": "L300",
    "custom_fields": [ /* matric number, level, department — shown on the Paystack receipt */ ]
  }
}
```

Metadata is for humans reading the Paystack dashboard. It is never read back as
an authority: fulfilment compares the provider's amount and currency against the
payment record, not against metadata a client could influence.

---

## Amounts

Paystack takes NGN amounts in **kobo**. ₦5,000 is `500000`. This application
stores every amount in kobo end to end, so no conversion happens at the boundary
— which is exactly where currency bugs usually live.

---

## Go-live checklist

- [ ] Paystack business verification complete and settlement account confirmed
- [ ] Live keys set in the production environment
- [ ] **Live** webhook URL configured (separately from test)
- [ ] Real dues amounts configured under Fees — not seeded sample values
- [ ] Academic session created and activated
- [ ] Departments match the college's actual departments
- [ ] `NEXT_PUBLIC_APP_URL` is the domain students will use (receipt and QR links)
- [ ] One real payment made, verified, receipt checked, then refunded and the
      refund recorded in the dashboard
- [ ] Settings → Configuration shows live mode and no warnings
