# Remove the AbacatePay Pix rail — verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: a2d512d..2790f89
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Round 1 returned FAIL on a single grounded finding: the BRT day window's upper bound in
`unpaidPixPerAcademy` was a predicate no proof asserted, and the mutation that removed it stayed
green across all 860 tests. The fix (`bec7e9b`) adds exactly one integration case and touches no
production code. Re-verified at `2790f89`: the mutation is now killed, by that one case alone, and
so is the `lt` -> `lte` boundary variant. Nothing else is outstanding.

## Round 2 scope

| Item | Provenance |
| --- | --- |
| every proof, re-run in full and batched | verified at 2790f89 — green is a property of a commit |
| `unpaidPixPerAcademy` predicates coverage row | recomputed at 2790f89 |
| the `Decides, and reachable only through SQL` policy row (unmet in round 1) | re-judged at 2790f89 |
| faults on the surface the fix created | injected at 2790f89 (F6, F7) |
| `platform-summary.integration.test.ts` citations | refreshed at 2790f89 — line numbers moved |
| binding sources, the other 10 coverage rows, the other 3 policy rows, faults F2-F5, the `Swept` re-read | carried from 67846c9 |

What makes the carry-forward safe: the fix diff over `apps packages infra docs` names **only**
`apps/api/src/platform-summary.integration.test.ts`, and the diff over
`platform-summary.repository.postgres.ts` is empty. `unpaidPixPerAcademy` is byte-identical to what
round 1 reviewed, so no verdict that rested on production behaviour could have moved. Everything
else in `bec7e9b..2790f89` is under `.specs/`.

## Binding sources

*Carried from 67846c9 — the fix touched no interface, contract or document that a binding source
decides.*

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| Linear TAT-187 (`get_issue`, updated 2026-10-08) | yes — MCP, full description and 5 acceptance criteria read | none | - |
| `.specs/features/tat-104-asaas-payment-split/tasks.md` § *The AbacatePay rail is not dead code* (`:612`-`:648`) | yes — read verbatim | none | - |
| `.specs/features/tat-104-asaas-payment-split/tasks.md` § *The deploy, in order* (`:685`-`:693`) | yes — read verbatim | none | - |
| production SQL on `pending_pix_payments`, maintainer, 2026-10-08 | **no — unopenable from the repo** (a chat-reported query against production) | n/a | n/a |

The last row's `Contradiction` and `Uncovered` read `n/a` because the input is absent, rather than
because it was compared and found clean: nothing in this repository can reach a production
database, so there is nothing for a check to contradict. Recorded as unopened rather than as
opened.

Comparison against TAT-187's own enumeration of what stage 1 and stage 2 must remove — every item
it names is gone:

- `payment.routes.ts` pair, `PaymentService.createPixQrCode`, the repository trio, the webhook
  handler and its route, the `NO_PENDING_PIX` reason, the table, its `TRUNCATE_ALL` entry — all
  absent (C3/C4 greps exit 0; a grep for `still serves the Pix rail` and `createPixQrCode` over
  `apps` and `packages` returns nothing; `apps/api/src/modules/payment/` no longer holds an
  abacatepay file).
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
  fresher statement of the same gate, rather than a conflicting one.
- *"`select count(*) from pending_pix_payments` on production returns 0 before stage 2 starts"* —
  the plan's Assumptions row 3 states plainly that this literal criterion is unmet and proceeds on
  the maintainer's reasoning (`expiresIn: 1800`, nothing written for three months). That deviation
  is declared, owned and confirmed in the plan, so the checks do not contradict the source; it is
  simply outside what any proof in this repository can settle.

## Checks

*Proofs re-run in full at 2790f89, batched into two invocations plus three greps and the gate.
Citations in `platform-summary.integration.test.ts` refreshed at 2790f89; all other citations are
carried from 67846c9, where the cited files are unchanged in `67846c9..2790f89`.*

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `POST /v1/payments/checkout/pix` -> `404`, live sibling `POST /v1/payments/pix` -> `503` naming Clerk | unit batch, exit 0 — `no longer serves the AbacatePay Pix rail` shown individually | `apps/api/src/api.smoke.test.ts:34` — `expect(created.status).toBe(404)`; sibling at `:40`-`:41` — `expect(live.status).toBe(503)` and `expect(String(...error)).toContain("Clerk")` | PASS |
| C2 | `GET /v1/payments/pix-status/pix_char_x` -> `404` | same invocation, same test | `apps/api/src/api.smoke.test.ts:37` — `expect(status.status).toBe(404)` on the GET issued at `:36` | PASS |
| C3 | no tracked non-test file in scope matches `abacatepay` | `bash -c '! git grep -il -e abacatepay -- apps packages infra docs/observability.md ":!packages/db/drizzle" ":!*.test.ts"'` exit 0 | Recomputed: all 14 in-scope paths that matched at `a2d512d` are clean. What the narrowing permits is located and is not a code path: `apps/api/src/api.smoke.test.ts:32`, `:53`, `:55` (a test title and the asserted request path), `apps/api/src/platform-summary.integration.test.ts:115`, `apps/api/src/telemetry/events.test.ts:72`, `:75` (titles/comments). A case-insensitive grep for `abacatepay.com` over `apps packages infra` returns nothing, settling AC 3 | PASS |
| C4 | no tracked non-test file names the table or its six symbols | `bash -c '! git grep -l -e createPendingPix -e findPendingPixByQrCodeId -e deletePendingPix -e pendingPixPayments -e pending_pix_payments -e createPixQrCode -- apps packages infra docs/observability.md ":!packages/db/drizzle" ":!*.test.ts"'` exit 0 | Recomputed: all 10 in-scope paths that matched at `a2d512d` are clean. Residual test-file hits are assertions about the absence: `apps/api/src/migrations.integration.test.ts:45` — `expect(tables).not.toContain("pending_pix_payments")`. Harness proof: `apps/api/src/testing/integration-setup.ts:41`-`:63`, `TRUNCATE_ALL` lists `pending_asaas_payments` and omits `pending_pix_payments` | PASS |
| C5 | `POST /v1/payments/pix` opens an Asaas charge split 100% to the academy wallet | unit batch, exit 0 — `sends the whole split to the academy wallet` shown individually | `apps/api/src/modules/payment/payment.pix-charge.test.ts:39` — `split: [{ walletId: "wal_academy", percentualValue: 100 }]` inside `expect(ctx.client.createPayment).toHaveBeenCalledWith(...)` at `:34` | PASS |
| C6 | it persists one `pending_asaas_payments` row with what the webhook needs | unit batch, exit 0 — `records what the webhook will need to reconcile the charge` shown individually | `apps/api/src/modules/payment/payment.pix-charge.test.ts:57`-`:65` — `expect(await ctx.payRepo.findPendingAsaasByPaymentId("pay_new")).toEqual({ asaasPaymentId, kind: "payment", subscriptionId, userId, academyId, referenceMonth, amountCents: 15000 })` | PASS |
| C7 | an Asaas Pix charge reaches a `payments` row end to end | integration batch, exit 0 — `takes a Pix charge from QR code to a payment row` shown individually | `apps/api/src/asaas-payment.integration.test.ts:236`-`:245` — `expect(listed.body.items[0]).toMatchObject({ method: "pix", asaasPaymentId: "pay_int_1", amountCents: 15_000, ... })`, preceded by `:230` asserting nothing is recorded before the delivery | PASS |
| C8 | `POST /v1/webhooks/abacatepay` -> `404`, live sibling `POST /v1/webhooks/stripe` -> `503` | unit batch, exit 0 — `no longer accepts AbacatePay webhook deliveries` shown individually | `apps/api/src/api.smoke.test.ts:57` — `expect(dropped.status).toBe(404)`; sibling at `:60` — `expect(live.status).toBe(503)` | PASS |
| C9 | after the migration set, no `pending_pix_payments`, still `pending_asaas_payments` | integration batch, exit 0 — `drops pending_pix_payments and keeps the Asaas table` shown individually | `apps/api/src/migrations.integration.test.ts:45` — `expect(tables).not.toContain("pending_pix_payments")`; `:48` — `expect(tables).toContain("pending_asaas_payments")` | PASS |
| C10 | the reason union is exactly the seven, `NO_PENDING_PIX` among none | unit batch, exit 0 — `no longer accepts the AbacatePay drop reason` shown individually | `apps/api/src/telemetry/events.test.ts:76`-`:84` — `expect(CATALOG["payment.webhook_unhandled"].reasons).toEqual(["NO_PENDING_CHARGE", "MISSING_REFERENCE", "DUPLICATE_MONTH", "FOREIGN_ACCOUNT", "USER_OR_ACADEMY_NOT_FOUND", "OWNER_NOT_FOUND", "UNKNOWN_EVENT_TYPE"])` | PASS |
| C11 | reports the unpaid `kind='payment'` row as `count: 1, amountCents: 12000`, and neither the settled row nor the `checkout` row | integration batch, exit 0 — `counts an unpaid Asaas Pix charge, the rail that replaced AbacatePay` shown individually | `apps/api/src/platform-summary.integration.test.ts:183`-`:185` — `expect(rows).toEqual([{ academyId: academy.id, count: 1, amountCents: 12_000 }])`, against the three rows seeded at `:133`-`:166` (unpaid 12000, settled 30000, `kind: "checkout"` 50000) | PASS |
| C12 | reports nothing for a row created at 01:00 UTC on the window day (22:00 BRT the day before) | integration batch, exit 0 — `leaves an Asaas charge opened before the BRT day out` shown individually | `apps/api/src/platform-summary.integration.test.ts:209` — `expect(await repo.unpaidPixPerAcademy(window)).toEqual([])`, with `createdAt: LATE_PREVIOUS_BRT` at `:206` defined as `new Date("2026-09-11T01:00:00Z")` at `:35` | PASS |
| C13 | two academies get one row each with their own `amountCents`, rather than the sum | integration batch, exit 0 — `keeps each academy's unpaid Pix on its own row` shown individually | `apps/api/src/platform-summary.integration.test.ts:268` — `expect(rows).toHaveLength(2)`; `:269`-`:273` — `expect(rows).toEqual(expect.arrayContaining([{ ...first, amountCents: 10_000 }, { ...second, amountCents: 20_000 }]))` | PASS |
| C14 | `TRUNCATE_ALL` succeeds against the post-`0024` schema, so every integration test reaches its body | integration batch, exit 0 (and the full 131-test integration project, exit 0) | `apps/api/src/testing/integration-setup.ts:41`-`:63` — the list omits `pending_pix_payments`; executed at `:110` — `await db.execute(sql.raw(TRUNCATE_ALL))`; reached per test at `apps/api/src/platform-summary.integration.test.ts:56` — `await ctx.truncateAll()` in `beforeEach`, and the body's assertion at `:183` is reachable only if it raised nothing | PASS |
| C15 | neither `docs/observability.md` nor the Grafana rules name `NO_PENDING_PIX` | `bash -c '! git grep -l -e NO_PENDING_PIX -- docs/observability.md infra/observability/grafana/provisioning/alerting/rules.yml'` exit 0 | `infra/observability/grafana/provisioning/alerting/rules.yml:255` — `event_reason=~"NO_PENDING_CHARGE&#124;MISSING_REFERENCE"`; `docs/observability.md:607` — the alert row now reads `NO_PENDING_CHARGE` or `MISSING_REFERENCE`; `docs/observability.md:685` — the drop-reasons table keeps only the Asaas row | PASS |
| C16 | `typecheck`, `lint`, unit project, integration project all green | `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:integration` exit 0 at 2790f89 | typecheck 13/13 tasks; lint 8/8 tasks, 0 errors (5 pre-existing warnings in `@tatame/web`, a package this diff leaves alone); unit 730 passed / 0 failed in 42 files; integration **131** passed / 0 failed in 17 files — one more than round 1, which is C17 | PASS |
| C17 | reports nothing for an unpaid `kind='payment'` row created at exactly `window.end` (03:00 UTC the day after the BRT day) | integration batch, exit 0 — `leaves an Asaas charge opened at the exact end of the window out` shown individually | `apps/api/src/platform-summary.integration.test.ts:236` — `expect(await repo.unpaidPixPerAcademy(window)).toEqual([])`, with `createdAt: WINDOW_END` at `:233` defined as `new Date("2026-09-12T03:00:00Z")` at `:43` | PASS |

C5, C6 and C7 resolve to tests the feature diff does not modify. That is correct rather than
hollow: they are AC 4's regression claim about the **surviving** rail, and they exercise
`payment.service.ts`, a file this diff cut 133 lines from — so they do cover changed source.

### The boundary instant was the right choice, and it is load-bearing

The fix picks `window.end` exactly rather than a value comfortably past it. That reasoning holds,
arithmetically and empirically:

- `brtDayWindow` opens at `BRT_OFFSET_HOURS = 3` and spans `DAY_MS`
  (`platform-summary.service.ts:21`-`:22`, `:45`-`:48`), so for `DAY = "2026-09-11"` the window ends
  at `2026-09-12T03:00:00Z` — which is `WINDOW_END` at
  `platform-summary.integration.test.ts:43`, to the millisecond.
- Because the row sits *at* the excluded bound, the single case discriminates three
  implementations: `lt` (passes), `lte` (fails — fault F7), and no upper bound at all (fails —
  fault F6). A row placed an hour later would have killed F6 and left F7 alive, so the stricter
  choice is strictly stronger here rather than merely tidier.
- It is not a hypothetical slip: `lt` **and** `lte` are both already imported in that file
  (`platform-summary.repository.postgres.ts:22`-`:23`), so `lte` is a one-token mistake fully in
  scope.

One precision note, explicitly **not** a gap — nothing is unproven at `HEAD`. `WINDOW_END` is a
hardcoded literal rather than derived from `window.end`, so if `BRT_OFFSET_HOURS` or `DAY_MS` ever
changed, the constant would quietly stop being the boundary and the case would degrade into an
ordinary "after the window" test: still killing F6, no longer killing F7, with nothing turning red
to say so. Every other window constant in the file is hardcoded the same way, so the fix matches
local convention; deriving it, or adding `expect(WINDOW_END).toEqual(window.end)`, would make that
degradation loud. Worth doing the next time the file is opened, rather than worth a round 3.

### The author's two self-corrections, independently checked

*Carried from 67846c9.*

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
   (`:284`-`:285`), and `docs/observability.md` (`:607`, `:686`, `:704`). At `HEAD` the regex reads
   `NO_PENDING_CHARGE|MISSING_REFERENCE` (`rules.yml:255`) — still two live alternatives, so the
   alert keeps firing, exactly as the row claims.

## Coverage

Recomputed from the authority over each set, rather than read back from `checks.md`.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `unpaidPixPerAcademy` predicates (4) — **recomputed at 2790f89** | the SQL the method builds — `platform-summary.repository.postgres.ts:247`-`:268`, byte-identical to round 1 | `gte(createdAt, window.start)` -> C12 (`:209`) · **`lt(createdAt, window.end)` -> C17 (`:236`)** · `eq(kind, 'payment')` -> C11 (`:183`) · `notExists(payments …)` -> C11 (`:183`), plus the positive in-window case -> C11 | - |
| `unpaidPixPerAcademy` grouping arity (2) — recomputed at 2790f89 | `.groupBy(academyId)` at `:269` + the service calling `collectDay` on two windows (`platform-summary.service.ts:194`-`:195`) | one academy -> C11 · two academies kept apart -> C13 (`:268`) | - |
| `POST /v1/payments/checkout/pix` statuses (1) — carried from 67846c9 | Express's unmatched-path default + plan `Surface` | `404` -> C1 (`api.smoke.test.ts:34`) | - |
| `GET /v1/payments/pix-status/:pixQrCodeId` statuses (1) — carried from 67846c9 | same | `404` -> C2 (`api.smoke.test.ts:37`) | - |
| `POST /v1/webhooks/abacatepay` statuses (1) — carried from 67846c9 | same | `404` -> C8 (`api.smoke.test.ts:57`) | - |
| one-way doors in `Landing` (3) — carried from 67846c9 | `plan.md:85`-`:87` | table dropped -> C9 · routes withdrawn -> C1, C2, C8 · reason retired -> C10 | - |
| entities in `Relations` (3 nodes) — carried from 67846c9 | `plan.md:61`-`:65` mermaid | `PendingPixPayment` removed -> C9 · `PendingAsaasPayment` kept -> C11 · `StudentSubscription` untouched, carries no claim | - |
| `payment.webhook_unhandled` reasons (7) — carried from 67846c9 | `telemetry/events.ts:88`-`:115` `CATALOG` | all 7, in order, as one array equality -> C10 | - |
| removal sites naming the provider (14) — carried from 67846c9 | a case-insensitive `abacatepay` grep at `a2d512d` in C3's path scope — recomputed to exactly 14 | all 14 clean at `HEAD` -> C3 | - |
| removal sites naming the table or its methods (10) — carried from 67846c9 | the same six-symbol grep at `a2d512d` — recomputed to exactly 10 | all 10 clean at `HEAD` -> C4 | - |
| startup config: assemblies under test (2) — carried from 67846c9 | each suite's own construction, read directly | unit: `api.smoke.test.ts:3` imports `createApp` from `./app.js`, `:6` `const app = createApp()` -> C1, C8 · integration: `asaas-payment.integration.test.ts:140` `setupIntegrationTest()` then `:142`-`:143` `const { createApp } = await import("./app.js"); app = createApp()` -> C7, C14 | - |

The predicates row is the one the fix moved, and it now closes. Recomputing from the SQL gives
**four** `where` predicates, each of which finally carries its own asserted excluded case — the
fourth via C17. `checks.md` labels the same row "(5)" by counting the positive in-window case as a
member alongside the four predicates; that is a labelling difference rather than a gap, since the
recompute and the artifact agree on every predicate having a proof.

Sets swept for and found to need no row: the drizzle journal (`meta/_journal.json` records `idx: 24`,
`tag: "0024_drop_pending_pix_payments"` once, which is the `Swept` idempotency claim); the
`pending_asaas_payments` `kind` values (2, both asserted inside C11); the plan's 11 acceptance
criteria (each maps to at least one check — AC 1->C1, 2->C2, 3->C3/C4, 4->C5/C6/C7, 5->C8, 6->C9,
7->C10, 8->C11/C12/C13/C17, 9->C11, 10->C4/C14, 11->C15).

### `Swept` rows resolving to `existing`

*Carried from 67846c9 — the fix changed nothing these rows cite.*

| Row | Constraint it cites | Actually there |
| --- | --- | --- |
| failure modes | no live client calls the removed routes; no surviving code path reads the dropped table | yes — C1/C2/C8 at the boundary, and C4's grep over the in-scope non-test tree is empty |
| idempotency | the drizzle journal applies `0024` once | yes — `packages/db/drizzle/meta/_journal.json`, a single `idx: 24` entry for `0024_drop_pending_pix_payments` |
| observability | the reason leaves the catalogue, the LogQL query and both documents; `catalog-coverage.test.ts` fails if the three disagree | yes — `events.ts` (C10), `rules.yml:255`, `docs/observability.md:607`/`:685`, and `catalog-coverage.test.ts` sits inside the 730 green unit tests |
| data lifecycle | `0024` destroys the table and its rows | yes — `packages/db/drizzle/0024_drop_pending_pix_payments.sql` is exactly `DROP TABLE "pending_pix_payments" CASCADE;`, the literal shape the first `Landing` row promised |

The `n/a` rows (validation, authorization, concurrency, dependency failure, state transitions) are
approved policy with nothing in the code to be wrong about.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, and reachable only through SQL — **re-judged at 2790f89** | `platform-summary.repository.postgres.ts#unpaidPixPerAcademy` | one integration-layer proof against real Postgres; one asserted case **per predicate**, one per grouping-key arity | yes — the level is right (C11, C12, C13, C17 all run against testcontainers Postgres), the grouping arity holds (1 academy C11, 2 academies C13), and all four `where` predicates now carry their own asserted case, the fourth via C17 at `platform-summary.integration.test.ts:236`. This row was the round-1 finding, and `bec7e9b` closes it |
| Entry point that decides nothing — a route's existence — carried from 67846c9 | `payment.routes.ts` removed handlers; the `/webhooks/abacatepay` handler | one boundary proof through the assembled app: the path under claim plus a live sibling on the same router in the same test | yes — C1 pairs `404` at `api.smoke.test.ts:34`/`:37` with `POST /v1/payments/pix` -> `503` at `:40` in the same test; C8 pairs `404` at `:57` with `POST /v1/webhooks/stripe` -> `503` at `:60` |
| A closed set declared as data — carried from 67846c9 | `telemetry/events.ts` `CATALOG` | one direct assertion over the whole collection — array equality, never membership | yes — `events.test.ts:76` is `toEqual([…7 reasons])`, and F5 (re-adding `NO_PENDING_PIX`) kills it, which a membership test could never have done |
| Instrumentation — a repository method forwarding one query — carried from 67846c9 | `payment.repository.ts`, `.postgres.ts`, `.in-memory.ts` pending-pix trio | none of its own; covered by its consumer's proof | yes — all three are deleted along with their consumer; C4's grep is empty over those files and `typecheck` is 13/13, so every caller went with them |

## Faults injected

Isolated in a throwaway `git worktree add <scratch> HEAD`; the real tree's `git status --porcelain`
was empty before and is empty after, and the scratch worktree is removed. No `git stash` was used.
Round 2 re-injected on the surface the fix created — the new C17 assertion, which had never been
made to fail by this Verifier — and on the surface it was built to protect.

| Mutation | Location | Killed |
| --- | --- | --- |
| F6 — dropped the day window's upper bound `lt(pendingAsaasPayments.createdAt, window.end)`; this is round 1's finding, re-injected at 2790f89 | `platform-summary.repository.postgres.ts:250` | yes — killed by C17 alone (`platform-summary.integration.test.ts:236`), with the other 8 cases in that file green. At 67846c9 this same mutation was caught by nothing: the whole unit project and the whole integration project stayed green, which is what carried round 1's FAIL |
| F7 — shifted the same bound by one instant, `lt` -> `lte` (both already imported, so a one-token slip) | `platform-summary.repository.postgres.ts:250` | yes — killed by C17 alone, `AssertionError: expected [ { …(3) } ] to deeply equal []`, other 8 cases green. This is the fault the boundary-instant choice exists to catch, and a row placed past `window.end` would have left it alive |
| F2 — dropped the rail filter `eq(pendingAsaasPayments.kind, "payment")` | `platform-summary.repository.postgres.ts:251` | yes — carried from 67846c9; C11 failed with actual `count: 2, amountCents: 62000` against expected `count: 1, amountCents: 12000` (the card checkout got counted as a Pix). Production code is byte-identical in `67846c9..2790f89` |
| F3 — dropped the settled-charge exclusion `notExists(select 1 from payments where payments.asaas_payment_id = …)` | `platform-summary.repository.postgres.ts:256`-`:266` | yes — carried from 67846c9; C11 failed (the already-settled 30000 row got counted) |
| F4 — left `POST /checkout/pix` mounted, answering `200 {pixQrCodeId}` (an incomplete removal) | `payment.routes.ts:244` (injected) | yes — carried from 67846c9; C1 failed at `api.smoke.test.ts:34`, received `200` against expected `404` |
| F5 — restored `"NO_PENDING_PIX"` to the `payment.webhook_unhandled` reasons array | `telemetry/events.ts:96` | yes — carried from 67846c9; C10 failed at `events.test.ts:76` on the array equality |

Budget notes. Six distinct mutations across the two rounds, against a cap of five per round; four of
the six target `unpaidPixPerAcademy`, where the brief put the budget and where the one real defect
was. F6 and F7 are the round-2 injections and both land on the surface `bec7e9b` created. Three
surfaces carrying checks were still never made to fail: `asaas-payment.integration.test.ts` (C7),
`payment.pix-charge.test.ts` (C5, C6) and `migrations.integration.test.ts` (C9). All three assert
untouched or newly-added positive behaviour, and this is stated as a residual limitation of the cap
rather than as a finding.

### Why this mutation mattered

The cron fires at 07:00 BRT and summarises the BRT day that just ended
(`platform-summary.worker.ts:36`-`:40`), and the service calls `collectDay` **twice** — once for
that window and once for the day before it, for the day-over-day comparison
(`platform-summary.service.ts:170`-`:171`, `:194`-`:195`, `:282`). With the upper bound gone,
`unpaidPixPerAcademy` becomes "everything unpaid from `window.start` onward": the reported day
absorbs the seven hours of the current morning, the comparison day absorbs a further 31 hours, both
numbers grow without bound, and the comparison between them stops meaning anything. Nothing throws
and nothing renders differently — the number just stops measuring the day it is labelled with. That
is the bug TAT-104 already fixed once in this exact function, it is why `AGENTS.md` buys the
`standard` profile, and C17 is now the assertion that catches it.

## Gate

`pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:integration` — exit 0 at 2790f89;
typecheck 13/13 tasks, lint 8/8 tasks with 0 errors, unit 730 passed / 0 failed in 42 files,
integration 131 passed / 0 failed in 17 files.

Batched proof invocations at 2790f89, each named test shown individually as having run and passed:

- unit — `vitest run --project unit src/api.smoke.test.ts src/modules/payment/payment.pix-charge.test.ts src/telemetry/events.test.ts -t "(…5 names…)"` — 5 passed, 0 failed
- integration — `vitest run --project integration src/asaas-payment.integration.test.ts src/migrations.integration.test.ts src/platform-summary.integration.test.ts -t "(…6 names, C17 included…)"` — 6 passed, 0 failed
- C3, C4, C15 greps — exit 0 each

`docker image inspect postgres:16-alpine` exited 0 before every integration run, so the hazard
documented at the end of `checks.md` did not occur in either round.

## Ranked gaps

None. Round 1's single gap — the unproven `lt(createdAt, window.end)` predicate and the mutation
that nothing caught — is closed by C17: the predicate now has its own asserted case, the coverage
row recomputes with nothing unproven, the `Decides, and reachable only through SQL` policy row is
met, and both the original mutation and its `lte` variant are killed by that case alone. All 17
checks pass with located evidence and the repository gate is green at 2790f89.

The one item left for whoever next opens `platform-summary.integration.test.ts` is cosmetic and
recorded above: derive `WINDOW_END` from `window.end`, or assert their equality, so the case cannot
silently degrade from a boundary test into an after-the-window test.
