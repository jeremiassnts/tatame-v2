# Remove the AbacatePay Pix rail — verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: a2d512d..67846c9
**Round**: 1 — full
**Verifier**: independent sub-agent (author != verifier)

**Why FAIL.** All 16 checks pass at `HEAD` with located evidence, and the repository gate is green.
The feature fails on the one thing only `standard` can see: a behaviour-level fault in the single
riskiest edit — `unpaidPixPerAcademy` — **survives the entire 860-test suite**. The BRT day
window's upper bound is a predicate no proof asserts, so the function can be left counting every
unpaid Asaas Pix charge created after the reported day ended and nothing turns red. That is the
same failure class this function already shipped once (a metric that keeps rendering and stops
measuring), one coverage member unproven, and one `Test policy` row unmet.

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| Linear TAT-187 (`get_issue`, updated 2026-10-08) | yes — MCP, full description and 5 acceptance criteria read | none | - |
| `.specs/features/tat-104-asaas-payment-split/tasks.md` § *The AbacatePay rail is not dead code* (`:612-648`) | yes — read verbatim | none | - |
| `.specs/features/tat-104-asaas-payment-split/tasks.md` § *The deploy, in order* (`:685-693`) | yes — read verbatim | none | - |
| production SQL on `pending_pix_payments`, maintainer, 2026-10-08 | **no — unopenable from the repo** (a chat-reported query against production) | not assessable | not assessable |

Comparison against TAT-187's own enumeration of what stage 1 and stage 2 must remove — every item
it names is gone:

- `payment.routes.ts` pair, `PaymentService.createPixQrCode`, the repository trio, the webhook
  handler and its route, the `NO_PENDING_PIX` reason, the table, its `TRUNCATE_ALL` entry — all
  absent (C3/C4 greps exit 0; `git grep -n "still serves the Pix rail\|createPixQrCode" -- apps
  packages` returns nothing; `apps/api/src/modules/payment/` no longer holds an abacatepay file).
- The two tests TAT-187 names for deletion by title (`still serves the Pix rail the shipped app
  calls`, `createPixQrCode returns 409`) are both gone, and so is the `AbacatePay webhook drops`
  block the plan's Assumptions row covers.
- `unpaidPixPerAcademy` kept the Asaas half **with** its `kind = 'payment'` filter, as TAT-187
  demands — `platform-summary.repository.postgres.ts:251`.

Two gates TAT-187 sets are **environment facts the repository cannot answer**, and both are
maintainer-attested in the plan rather than proven here. Neither is a contradiction; both are
recorded so nobody later mistakes them for verified:

- *"`MIN_MOBILE_VERSION` is confirmed past the last build that called `/payments/checkout/pix`"* —
  `packages/config/src/env.ts:17` only defaults it to `1.0.0`; the production value is unopenable.
  TAT-187's prose still says the stores hold 2.1.2 while the plan says 2.1.3 on a later (2026-10-08)
  maintainer confirmation. The issue's own `updatedAt` is that same day, so the plan carries the
  fresher statement of the same gate, not a conflicting one.
- *"`select count(*) from pending_pix_payments` on production returns 0 before stage 2 starts"* —
  the plan's Assumptions row 3 states plainly that this literal criterion is **not met** and
  proceeds on the maintainer's reasoning (`expiresIn: 1800`, nothing written for three months).
  That deviation is declared, owned and confirmed in the plan, so the checks do not contradict the
  source; it is simply outside what any proof in this repo can settle.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `POST /v1/payments/checkout/pix` → `404`, live sibling `POST /v1/payments/pix` → `503` naming Clerk | unit batch, exit 0 — `no longer serves the AbacatePay Pix rail` shown ✓ | `apps/api/src/api.smoke.test.ts:34` — `expect(created.status).toBe(404)`; sibling at `:40`–`:41` — `expect(live.status).toBe(503)` and `expect(String(...error)).toContain("Clerk")` | PASS |
| C2 | `GET /v1/payments/pix-status/pix_char_x` → `404` | same invocation, same test ✓ | `apps/api/src/api.smoke.test.ts:37` — `expect(status.status).toBe(404)` on the GET issued at `:36` | PASS |
| C3 | no tracked non-test file in scope matches `abacatepay` | `bash -c '! git grep -il -e abacatepay -- apps packages infra docs/observability.md ":!packages/db/drizzle" ":!*.test.ts"'` exit 0 | Recomputed: all 14 in-scope paths that matched at `a2d512d` are clean. What the narrowing permits is located and is not a code path: `apps/api/src/api.smoke.test.ts:32`, `:53`, `:55` (a test title and the asserted request path), `apps/api/src/platform-summary.integration.test.ts:107`, `apps/api/src/telemetry/events.test.ts:72`, `:75` (titles/comments). `git grep -in "abacatepay.com" -- apps packages infra` returns nothing, settling AC 3 | PASS |
| C4 | no tracked non-test file names the table or its six symbols | `bash -c '! git grep -l -e createPendingPix -e findPendingPixByQrCodeId -e deletePendingPix -e pendingPixPayments -e pending_pix_payments -e createPixQrCode -- apps packages infra docs/observability.md ":!packages/db/drizzle" ":!*.test.ts"'` exit 0 | Recomputed: all 10 in-scope paths that matched at `a2d512d` are clean. Residual test-file hits are assertions about the absence: `apps/api/src/migrations.integration.test.ts:45` — `expect(tables).not.toContain("pending_pix_payments")`. Harness proof: `apps/api/src/testing/integration-setup.ts:41`–`:63`, `TRUNCATE_ALL` lists `pending_asaas_payments` and not `pending_pix_payments` | PASS |
| C5 | `POST /v1/payments/pix` opens an Asaas charge split 100% to the academy wallet | unit batch, exit 0 — `sends the whole split to the academy wallet` shown ✓ | `apps/api/src/modules/payment/payment.pix-charge.test.ts:39` — `split: [{ walletId: "wal_academy", percentualValue: 100 }]` inside `expect(ctx.client.createPayment).toHaveBeenCalledWith(...)` at `:34` | PASS |
| C6 | it persists one `pending_asaas_payments` row with what the webhook needs | unit batch, exit 0 — `records what the webhook will need to reconcile the charge` shown ✓ | `apps/api/src/modules/payment/payment.pix-charge.test.ts:57`–`:65` — `expect(await ctx.payRepo.findPendingAsaasByPaymentId("pay_new")).toEqual({ asaasPaymentId, kind: "payment", subscriptionId, userId, academyId, referenceMonth, amountCents: 15000 })` | PASS |
| C7 | an Asaas Pix charge reaches a `payments` row end to end | integration batch, exit 0 — `takes a Pix charge from QR code to a payment row` shown ✓ | `apps/api/src/asaas-payment.integration.test.ts:236`–`:245` — `expect(listed.body.items[0]).toMatchObject({ method: "pix", asaasPaymentId: "pay_int_1", amountCents: 15_000, ... })`, preceded by `:230` asserting nothing is recorded before the delivery | PASS |
| C8 | `POST /v1/webhooks/abacatepay` → `404`, live sibling `POST /v1/webhooks/stripe` → `503` | unit batch, exit 0 — `no longer accepts AbacatePay webhook deliveries` shown ✓ | `apps/api/src/api.smoke.test.ts:57` — `expect(dropped.status).toBe(404)`; sibling at `:60` — `expect(live.status).toBe(503)` | PASS |
| C9 | after the migration set, no `pending_pix_payments`, still `pending_asaas_payments` | integration batch, exit 0 — `drops pending_pix_payments and keeps the Asaas table` shown ✓ | `apps/api/src/migrations.integration.test.ts:45` — `expect(tables).not.toContain("pending_pix_payments")`; `:48` — `expect(tables).toContain("pending_asaas_payments")` | PASS |
| C10 | the reason union is exactly the seven, `NO_PENDING_PIX` among none | unit batch, exit 0 — `no longer accepts the AbacatePay drop reason` shown ✓ | `apps/api/src/telemetry/events.test.ts:76`–`:84` — `expect(CATALOG["payment.webhook_unhandled"].reasons).toEqual(["NO_PENDING_CHARGE", "MISSING_REFERENCE", "DUPLICATE_MONTH", "FOREIGN_ACCOUNT", "USER_OR_ACADEMY_NOT_FOUND", "OWNER_NOT_FOUND", "UNKNOWN_EVENT_TYPE"])` | PASS |
| C11 | reports the unpaid `kind='payment'` row as `count: 1, amountCents: 12000`, and neither the settled row nor the `checkout` row | integration batch, exit 0 — `counts an unpaid Asaas Pix charge, the rail that replaced AbacatePay` shown ✓ | `apps/api/src/platform-summary.integration.test.ts:175`–`:177` — `expect(rows).toEqual([{ academyId: academy.id, count: 1, amountCents: 12_000 }])`, against the three rows seeded at `:125`–`:158` (unpaid 12000, settled 30000, `kind: "checkout"` 50000) | PASS |
| C12 | reports nothing for a row created at 01:00 UTC on the window day (22:00 BRT the day before) | integration batch, exit 0 — `leaves an Asaas charge opened before the BRT day out` shown ✓ | `apps/api/src/platform-summary.integration.test.ts:201` — `expect(await repo.unpaidPixPerAcademy(window)).toEqual([])`, with `createdAt: LATE_PREVIOUS_BRT` at `:198` defined as `new Date("2026-09-11T01:00:00Z")` at `:35` | PASS |
| C13 | two academies get one row each with their own `amountCents`, not the sum | integration batch, exit 0 — `keeps each academy's unpaid Pix on its own row` shown ✓ | `apps/api/src/platform-summary.integration.test.ts:233`–`:238` — `expect(rows).toHaveLength(2)` and `expect(rows).toEqual(expect.arrayContaining([{ ...first, amountCents: 10_000 }, { ...second, amountCents: 20_000 }]))` | PASS |
| C14 | `TRUNCATE_ALL` succeeds against the post-`0024` schema, so every integration test reaches its body | integration batch, exit 0 (and the full 130-test integration project, exit 0) | `apps/api/src/testing/integration-setup.ts:41`–`:63` — the list no longer names `pending_pix_payments`; executed at `:110` — `await db.execute(sql.raw(TRUNCATE_ALL))`; reached per test at `apps/api/src/platform-summary.integration.test.ts:48` — `await ctx.truncateAll()` in `beforeEach`, and the body's assertion at `:175` is only reachable if it did not raise | PASS |
| C15 | neither `docs/observability.md` nor the Grafana rules name `NO_PENDING_PIX` | `bash -c '! git grep -l -e NO_PENDING_PIX -- docs/observability.md infra/observability/grafana/provisioning/alerting/rules.yml'` exit 0 | `infra/observability/grafana/provisioning/alerting/rules.yml:255` — `event_reason=~"NO_PENDING_CHARGE|MISSING_REFERENCE"`; `docs/observability.md:607` — the alert row now reads `NO_PENDING_CHARGE` or `MISSING_REFERENCE`; `docs/observability.md:685` — the drop-reasons table keeps only the Asaas row | PASS |
| C16 | `typecheck`, `lint`, unit project, integration project all green | `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:integration` exit 0 | typecheck 13/13 tasks; lint 8/8 tasks, 0 errors (5 pre-existing warnings in `@tatame/web`, a package this diff does not touch); unit 730 passed / 0 failed in 42 files; integration 130 passed / 0 failed in 17 files | PASS |

All proofs were re-run by the Verifier at `67846c9`. `checks.md` records the gate as green at
`ea6347c`; `67846c9` is one docs-only commit later and the gate is green there too.

C5, C6 and C7 resolve to tests the diff does not modify. That is correct rather than hollow: they
are AC 4's regression claim about the **surviving** rail, and they exercise
`payment.service.ts`, a file this diff cut 133 lines from — so they do cover changed source.

### The author's two self-corrections, independently checked

1. **C3/C4 narrowed to non-test files — honest.** The exclusion is literally `:!*.test.ts`, which
   is narrower than it sounds: `*.test.tsx`, factories, and `src/testing/*.ts` stay in scope, so
   the harness file that matters (`integration-setup.ts`) is still covered by C4. Every residual
   hit was located and read; all six are a test title, a comment, an asserted request path, or an
   assertion of absence (cited in the C3/C4 rows). The blockquote's two backstops hold: the
   `pendingPixPayments` symbol is gone from `packages/db/src/schema/index.ts`, so any reference in
   any file fails `typecheck` (13/13 green), and the only raw table string left sits in an
   `information_schema` negative assertion. The narrowing lets through nothing I could find.
2. **The corrected `NO_PENDING_PIX` Impact row — true of the tree.** At the base commit
   `a2d512d:infra/.../rules.yml:253` the LogQL expr read
   `event_reason=~"NO_PENDING_PIX|NO_PENDING_CHARGE|MISSING_REFERENCE"`, so the first version of
   that row ("named only in prose") was indeed wrong and the correction is right. All three
   readers the corrected row claims existed at base: the query (`:253`), the email description
   (`:284`–`:285`), and `docs/observability.md` (`:607`, `:686`, `:704`). At `HEAD` the regex
   reads `NO_PENDING_CHARGE|MISSING_REFERENCE` (`rules.yml:255`) — still two live alternatives, so
   the alert keeps firing, exactly as the row claims.

## Coverage

Recomputed from the authority over each set, not read back from `checks.md`.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `POST /v1/payments/checkout/pix` statuses (1) | Express's unmatched-path default + plan `Surface` | `404` -> C1 (`api.smoke.test.ts:34`) | - |
| `GET /v1/payments/pix-status/:pixQrCodeId` statuses (1) | same | `404` -> C2 (`api.smoke.test.ts:37`) | - |
| `POST /v1/webhooks/abacatepay` statuses (1) | same | `404` -> C8 (`api.smoke.test.ts:57`) | - |
| one-way doors in `Landing` (3) | `plan.md:85`–`:87` | table dropped -> C9 · routes withdrawn -> C1, C2, C8 · reason retired -> C10 | - |
| entities in `Relations` (3 nodes) | `plan.md:61`–`:65` mermaid | `PendingPixPayment` removed -> C9 · `PendingAsaasPayment` kept -> C11 · `StudentSubscription` untouched, carries no claim | - |
| `unpaidPixPerAcademy` predicates (4) | the SQL the method builds — `platform-summary.repository.postgres.ts:247`–`:268` | `gte(createdAt, window.start)` -> C12 · `eq(kind, 'payment')` -> C11 · `notExists(payments …)` -> C11 · **`lt(createdAt, window.end)` -> no proof** | **`lt(pendingAsaasPayments.createdAt, window.end)` — the day window's upper bound; killed by no test, and fault F1 proves it** |
| `unpaidPixPerAcademy` grouping arity (2) | `.groupBy(academyId)` at `:269` + the service calling `collectDay` on two windows (`platform-summary.service.ts:194`–`:195`) | one academy -> C11 · two academies kept apart -> C13 | - |
| `payment.webhook_unhandled` reasons (7) | `telemetry/events.ts:88`–`:115` `CATALOG` | all 7, in order, as one array equality -> C10 | - |
| removal sites naming the provider (14) | `git grep -il abacatepay a2d512d` in C3's path scope — recomputed to exactly 14 | all 14 clean at `HEAD` -> C3 | - |
| removal sites naming the table or its methods (10) | same grep at `a2d512d` — recomputed to exactly 10 | all 10 clean at `HEAD` -> C4 | - |
| startup config: assemblies under test (2) | each suite's own construction, read directly | unit: `api.smoke.test.ts:3` imports `createApp` from `./app.js`, `:6` `const app = createApp()` -> C1, C8 · integration: `asaas-payment.integration.test.ts:140` `setupIntegrationTest()` then `:142`–`:143` `const { createApp } = await import("./app.js"); app = createApp()` -> C7, C14 | - |

Sets swept for and found to need no row: the drizzle journal (`meta/_journal.json` records `idx: 24`,
`tag: "0024_drop_pending_pix_payments"` once, which is the `Swept` idempotency claim); the
`pending_asaas_payments` `kind` values (2, both asserted inside C11); the plan's 11 acceptance
criteria (each maps to at least one check — AC 1→C1, 2→C2, 3→C3/C4, 4→C5/C6/C7, 5→C8, 6→C9, 7→C10,
8→C11/C12/C13, 9→C11, 10→C4/C14, 11→C15).

One labelling nit, not a gap: `checks.md` sizes the `Relations` set at 2 where the plan's diagram
has 3 nodes. The third, `StudentSubscription`, is untouched and carries no claim, so nothing is
unproven by it.

### `Swept` rows resolving to `existing`

| Row | Constraint it cites | Actually there |
| --- | --- | --- |
| failure modes | no live client calls the removed routes; no surviving code path reads the dropped table | yes — C1/C2/C8 at the boundary, and C4's grep over the in-scope non-test tree is empty |
| idempotency | the drizzle journal applies `0024` once | yes — `packages/db/drizzle/meta/_journal.json`, a single `idx: 24` entry for `0024_drop_pending_pix_payments` |
| observability | the reason leaves the catalogue, the LogQL query and both documents; `catalog-coverage.test.ts` fails if the three disagree | yes — `events.ts` (C10), `rules.yml:255`, `docs/observability.md:607`/`:685`, and `catalog-coverage.test.ts` is inside the 730 green unit tests |
| data lifecycle | `0024` destroys the table and its rows | yes — `packages/db/drizzle/0024_drop_pending_pix_payments.sql` is exactly `DROP TABLE "pending_pix_payments" CASCADE;`, the literal shape the first `Landing` row promised |

The `n/a` rows (validation, authorization, concurrency, dependency failure, state transitions) are
approved policy with nothing in the code to be wrong about.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, and reachable only through SQL | `platform-summary.repository.postgres.ts#unpaidPixPerAcademy` | one integration-layer proof against real Postgres; one asserted case **per predicate**, one per grouping-key arity | **no** — the level is right (C11–C13 all run against testcontainers Postgres) and the grouping arity is met (1 academy C11, 2 academies C13), but "one asserted case per predicate" fails on the fourth predicate: `lt(createdAt, window.end)` has no case, and fault F1 removing it leaves all 860 tests green |
| Entry point that decides nothing — a route's existence | `payment.routes.ts` removed handlers; the `/webhooks/abacatepay` handler | one boundary proof through the assembled app: the path under claim plus a live sibling on the same router in the same test | yes — C1 pairs `404` at `api.smoke.test.ts:34`/`:37` with `POST /v1/payments/pix` → `503` at `:40` in the same test; C8 pairs `404` at `:57` with `POST /v1/webhooks/stripe` → `503` at `:60` |
| A closed set declared as data | `telemetry/events.ts` `CATALOG` | one direct assertion over the whole collection — array equality, never membership | yes — `events.test.ts:76` is `toEqual([...7 reasons])`, and F5 (re-adding `NO_PENDING_PIX`) kills it, which a membership test would not have done |
| Instrumentation — a repository method forwarding one query | `payment.repository.ts`, `.postgres.ts`, `.in-memory.ts` pending-pix trio | none of its own; covered by its consumer's proof | yes — all three are deleted along with their consumer; C4's grep is empty over those files and `typecheck` is 13/13, so no caller survives them |

## Faults injected

Isolated in a throwaway `git worktree add <scratch> HEAD`; the real tree's `git status --porcelain`
was empty before and is empty after, and the scratch worktree is removed. No `git stash` was used.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 — dropped the day window's upper bound `lt(pendingAsaasPayments.createdAt, window.end)` | `platform-summary.repository.postgres.ts:250` | **no — survived** C11, C12, C13 individually, all 8 cases in `platform-summary.integration.test.ts`, and then the whole suite: unit 730/730 passed, integration 130/130 passed |
| F2 — dropped the rail filter `eq(pendingAsaasPayments.kind, "payment")` | `platform-summary.repository.postgres.ts:251` | yes — C11 fails at `platform-summary.integration.test.ts:175`, actual `count: 2, amountCents: 62000` against expected `count: 1, amountCents: 12000` (the card checkout got counted as a Pix) |
| F3 — dropped the settled-charge exclusion `notExists(select 1 from payments where payments.asaas_payment_id = …)` | `platform-summary.repository.postgres.ts:256`–`:266` | yes — C11 fails at `platform-summary.integration.test.ts:175` (the already-settled 30000 row got counted) |
| F4 — left `POST /checkout/pix` mounted, answering `200 {pixQrCodeId}` (an incomplete removal) | `payment.routes.ts:244` (injected) | yes — C1 fails at `api.smoke.test.ts:34`, received `200` against expected `404` |
| F5 — restored `"NO_PENDING_PIX"` to the `payment.webhook_unhandled` reasons array | `telemetry/events.ts:96` | yes — C10 fails at `events.test.ts:76` on the array equality |

Budget notes. Five is the cap, and the brief put the budget on `unpaidPixPerAcademy`, so three of
the five went there; F4 and F5 cover the other two assertion-surface classes (`boundary` and
`closed set as data`). Three surfaces carrying checks were therefore **not** made to fail once:
`asaas-payment.integration.test.ts` (C7), `payment.pix-charge.test.ts` (C5, C6) and
`migrations.integration.test.ts` (C9). All three assert on untouched or newly-added positive
behaviour and are stated here as a residual limitation of the cap, not as a finding.

### Why F1 is a production defect and not a redundant predicate

The cron fires at 07:00 BRT and summarises the BRT day that just ended
(`platform-summary.worker.ts:36`–`:40`), and the service calls `collectDay` **twice** — once for
that window and once for the day before it, for the day-over-day comparison
(`platform-summary.service.ts:170`–`:171`, `:194`–`:195`, `:282`). With the upper bound gone,
`unpaidPixPerAcademy` becomes "everything unpaid from `window.start` onward": the reported day
absorbs the seven hours of the current morning, the comparison day absorbs a further 31 hours, both
numbers grow without bound, and the comparison between them stops meaning anything. Nothing throws
and nothing renders differently — the number just stops measuring the day it is labelled with. This
is the exact bug TAT-104 had to fix once in this exact function, which is why `AGENTS.md` buys the
`standard` profile.

## Gate

`pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:integration` — exit 0; typecheck 13/13
tasks, lint 8/8 tasks with 0 errors, unit 730 passed / 0 failed in 42 files, integration 130 passed
/ 0 failed in 17 files.

Batched proof invocations, each named test shown individually as having run and passed:

- unit — `vitest run --project unit src/api.smoke.test.ts src/modules/payment/payment.pix-charge.test.ts src/telemetry/events.test.ts -t "(…5 names…)"` — 5 passed, 0 failed
- integration — `vitest run --project integration src/asaas-payment.integration.test.ts src/migrations.integration.test.ts src/platform-summary.integration.test.ts -t "(…5 names…)"` — 5 passed, 0 failed
- C3, C4, C15 greps — exit 0 each

`docker image inspect postgres:16-alpine` exited 0 before every integration run; the hazard
documented at the end of `checks.md` did not occur.

## Ranked gaps

1. **The BRT day window's upper bound in `unpaidPixPerAcademy` is unproven, and the mutant that
   removes it survives all 860 tests.** — the `unpaidPixPerAcademy` predicates coverage row, the
   `Decides, and reachable only through SQL` test-policy row, and fault F1 —
   `apps/api/src/modules/platform-summary/platform-summary.repository.postgres.ts:250`. Fix: one
   more integration case next to
   `apps/api/src/platform-summary.integration.test.ts:183`, seeding an unpaid `kind: 'payment'` row
   with `createdAt` at or after `window.end` (e.g. `new Date("2026-09-12T04:00:00Z")`, 01:00 BRT on
   the 12th) and asserting `[]`. That case kills F1 and closes all three rows at once. No other
   check, coverage member or policy row is outstanding.
