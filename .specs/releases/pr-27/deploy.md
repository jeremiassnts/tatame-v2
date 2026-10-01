# PR #27 — manual deploy steps

Every step that is not done by merging. Run them in this order.

`main` deploys on merge, so **steps 1–3 happen before the merge.**

Reference values: `{ROOT_KEY}` is the production Asaas root API key,
`{API_PUBLIC_URL}` is the API's public base URL (same value as the env var),
`{TOKEN}` is what step 1 generates. Asaas production base URL is
`https://api.asaas.com`.

---

## Before the merge

### 1. Set the payment webhook token in Coolify

```bash
openssl rand -hex 32     # 64 chars, inside the 32–255 the schema allows
```

Set `ASAAS_PAYMENT_WEBHOOK_TOKEN` to that value on the API service in Coolify.

- **Use a value distinct from `ASAAS_WEBHOOK_TOKEN` and distinct per environment.**
  It falls back to `ASAAS_WEBHOOK_TOKEN` when unset, but sharing the value defeats the
  reason it was split: the account token is written into every academy subaccount,
  where an operator can read it.
- It is optional in the schema, so the deploy will not fail without it. Setting it
  first is what avoids a window where live deliveries 401.

### 2. Confirm a Pix key exists on the root account

```bash
curl -s -H "access_token: {ROOT_KEY}" https://api.asaas.com/v3/pix/addressKeys
```

Expect at least one key with `"status": "ACTIVE"`.

- If the list is empty, create one in the Asaas dashboard and wait — Asaas provisions
  keys asynchronously.
- **Until a key is ACTIVE every Pix QR fetch fails** with `400 invalid_action`
  ("Você não possui uma chave Pix cadastrada para recebimentos").

### 3. Confirm the evaluation caps fit

The first 60 days of a production Asaas account allow **10 subaccounts** and
**R$ 2.000 per charge**. Check the current subaccount count:

```bash
curl -s -H "access_token: {ROOT_KEY}" "https://api.asaas.com/v3/accounts?limit=100" \
  | grep -o '"totalCount":[0-9]*'
```

One subaccount per academy. If the rollout needs more than the remaining headroom, ask
Asaas to lift the cap before onboarding academies — a refusal arrives as a 400 with the
reason in Portuguese, which the app shows verbatim.

---

## Merge and deploy

### 4. Merge PR #27

Manual. The merge triggers the `main` deploy.

### 5. Apply the migrations

`0021`, `0022`, `0023`. All three are additive — safe to run before the deploy, and
safe to leave applied if the deploy is rolled back. No ordering constraint against the
API version.

```bash
pnpm --filter @tatame/db migrate
```

- `0021` — `pending_asaas_payments` table, `payments.asaas_payment_id` (unique),
  `users.asaas_customer_id`
- `0022` — `pending_asaas_kind` enum on `pending_asaas_payments`
- `0023` — unique index on `pending_asaas_payments (subscription_id, reference_month)`

`0021` and `0022` were already applied to the Coolify database by hand, and both are
written to be re-runnable, so applying the set again is a no-op for them.

**If `0023` fails** with `could not create unique index`: the table holds two open
charges for one month, which is two payable Asaas charges and real money. Read both
ids, cancel the loser in Asaas, delete that row, re-run. Do not delete a row to make
the migration pass.

Reverse, if ever needed:

```sql
DROP INDEX IF EXISTS "pending_asaas_payments_subscription_month_unique";
```

### 6. Register the root-account webhook — the step that decides the release

```bash
curl -X POST https://api.asaas.com/v3/webhooks \
  -H "access_token: {ROOT_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "tatame-payments-prod",
    "url": "{API_PUBLIC_URL}/v1/webhooks/asaas",
    "email": "jeremiassnts3@gmail.com",
    "enabled": true,
    "interrupted": false,
    "apiVersion": 3,
    "sendType": "SEQUENTIALLY",
    "authToken": "{TOKEN}",
    "events": [
      "PAYMENT_CONFIRMED",
      "PAYMENT_RECEIVED",
      "PAYMENT_REFUNDED",
      "PAYMENT_CHARGEBACK_REQUESTED",
      "PAYMENT_CHARGEBACK_DISPUTE",
      "PAYMENT_AWAITING_CHARGEBACK_REVERSAL"
    ]
  }'
```

- **Without this, no student payment is ever recorded, and nothing in the code says so.**
  A subaccount is not notified of a split it merely receives, so the only account that
  hears about a student's payment is the root one.
- Run it **after** the deploy, so the URL already answers.
- `authToken` must be the step 1 value. A wrong token **401s in silence**, and Asaas
  interrupts a repeatedly-failing queue until it is manually reactivated.
- `sendType: SEQUENTIALLY` keeps `PAYMENT_CONFIRMED` from overtaking `PAYMENT_RECEIVED`.
- `PAYMENT_DELETED` is deliberately not registered. The handler tolerates it; we cause
  it ourselves on every manual settlement, and alerting on it would make a manager
  taking cash at the counter look like a dropped payment.

Confirm it exists:

```bash
curl -s -H "access_token: {ROOT_KEY}" https://api.asaas.com/v3/webhooks
```

Check `enabled: true` and `interrupted: false`.

---

## Verify on production

### 7. One real payment, end to end

1. A student at an academy with an **approved** payout account opens the Pix screen.
2. The QR renders (proves step 2).
3. Pay it for real, small amount.
4. Within seconds the payment appears in the manager's Financeiro, and the money is in
   the **academy's** Asaas wallet, not ours (proves steps 1 and 6).

If the QR renders but the payment never appears, the webhook is the cause, not the
charge — re-check step 6.

```sql
-- should be empty once the payment lands; a row left behind means the webhook never arrived
select * from pending_asaas_payments;
```

---

## After the release

### 8. Submit the 2.1.3 store build

Version and build numbers are already bumped (`c56212e`: 2.1.3, `buildNumber` 2,
`versionCode` 2). Only the submission is pending.

The stores ask for a Terms and Privacy Policy link, and **no mobile screen has one**.
Decide where it goes before submitting, or expect a review question.

### 9. Raise `MIN_MOBILE_VERSION` to 2.1.3 — only after adoption

Blocked on step 8. **Do not do it early:** it locks out everyone still on 2.1.2.

This is what unblocks TAT-187 stage 1 (deleting the legacy AbacatePay Pix rail) and
makes the landing page's "Pix only" copy true — 2.1.2 can still pay by card until then.

### 10. Later: turn on `PAYOUT_ACCOUNT_REQUIRED`

Set it to `true` once the onboarding build is adopted. TAT-179's acceptance criterion
claims this gate is live; it is not, and no issue tracks the flip.

Before TAT-187 stage 2, check both tables have drained:

```sql
select count(*) from pending_asaas_payments;
select count(*) from pending_pix_payments;
```

---

## Not required, but know about it

- **Rotating `ASAAS_PAYMENT_WEBHOOK_TOKEN` later has no overlap window.** `tokensFor`
  returns only the payment token for `PAYMENT_*` events, and the Asaas-side
  `PUT /v3/webhooks/{id}` and the env change cannot be simultaneous — either order 401s
  live deliveries. This release escapes it because step 6 creates a new webhook rather
  than editing one. The first rotation does not.
- **A student who switches plan mid-month after paying can be charged twice.** Live in
  production today, predates this PR: `existsForSubscriptionReferenceMonth` is keyed by
  subscription while `replaceActiveSubscriptionForAcademy` always creates a new row. Not
  this release's doing and not fixed by it.
- **A manager who cancels Pro and resubscribes will be billed for nothing** once this
  merges — B7 in `handoff.md`. It works on `main` today; the TAT-185 guard in this PR
  breaks it. Deliberately left open: the only customer who cancelled has not come back.
