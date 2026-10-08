# Remove the AbacatePay Pix rail — checks

Profile: standard
Plan: `.specs/features/tat-187-remove-abacatepay-rail/plan.md`

17 checks in 2 slices · 3 one-way doors · 0 open, of which 0 block

Every proof runs from the repository root. The workspace packages must be built first
(`pnpm build`), because `@tatame/config` and `@tatame/db` resolve through `dist/`; the
integration project starts its own Postgres through testcontainers, so Docker has to be up.

## Checks

### S1 — The entry points are gone · 10 files · 99 KB · ~25k

**C1** - `POST /v1/payments/checkout/pix` answers `404`, while `POST /v1/payments/pix` on the same router answers `503` naming Clerk (AC 1)
Proof: `pnpm --filter @tatame/api exec vitest run --project unit src/api.smoke.test.ts -t "no longer serves the AbacatePay Pix rail"`

**C2** - `GET /v1/payments/pix-status/pix_char_x` answers `404` (AC 2)
Proof: `pnpm --filter @tatame/api exec vitest run --project unit src/api.smoke.test.ts -t "no longer serves the AbacatePay Pix rail"`

**C3** - No tracked non-test file under `apps`, `packages`, `infra` or `docs/observability.md` matches `abacatepay`, case-insensitive, outside `packages/db/drizzle` (AC 3)
Proof: `bash -c '! git grep -il -e abacatepay -- apps packages infra docs/observability.md ":!packages/db/drizzle" ":!*.test.ts"'`

**C4** - No tracked non-test file names `createPendingPix`, `findPendingPixByQrCodeId`, `deletePendingPix`, `pendingPixPayments`, `pending_pix_payments` or `createPixQrCode` (AC 3, AC 10)
Proof: `bash -c '! git grep -l -e createPendingPix -e findPendingPixByQrCodeId -e deletePendingPix -e pendingPixPayments -e pending_pix_payments -e createPixQrCode -- apps packages infra docs/observability.md ":!packages/db/drizzle" ":!*.test.ts"'`

> **Both narrowed to non-test files while building, and the reason is the point of
> the checks rather than a concession.** A removal's proofs have to name what was
> removed: `api.smoke.test.ts` asserts `404` under the title "no longer serves the
> AbacatePay Pix rail", and `migrations.integration.test.ts` asks
> `information_schema` for `pending_pix_payments` by name. Written repo-wide these
> two claims forbade their own proofs. What they are about is a surviving **code
> path**, and a test asserting an absence is not one. The symbols are still barred
> from test files by other means: `pendingPixPayments` is a type, so C16's
> `typecheck` fails on any reference, and a raw SQL string against the dropped
> table fails the integration project.

**C5** - `POST /v1/payments/pix` opens an Asaas charge whose split sends 100% to the academy wallet (AC 4)
Proof: `pnpm --filter @tatame/api exec vitest run --project unit src/modules/payment/payment.pix-charge.test.ts -t "sends the whole split to the academy wallet"`

**C6** - `POST /v1/payments/pix` persists one `pending_asaas_payments` row carrying the subscription, student, academy and reference month the webhook needs (AC 4)
Proof: `pnpm --filter @tatame/api exec vitest run --project unit src/modules/payment/payment.pix-charge.test.ts -t "records what the webhook will need to reconcile the charge"`

**C7** - An Asaas Pix charge reaches a `payments` row end to end through `POST /v1/webhooks/asaas` (AC 4)
Proof: `pnpm --filter @tatame/api exec vitest run --project integration src/asaas-payment.integration.test.ts -t "takes a Pix charge from QR code to a payment row"`

### S2 — The recording side and the table are gone · 14 files · 243 KB · ~61k

**C8** - `POST /v1/webhooks/abacatepay` answers `404`, while `POST /v1/webhooks/stripe` on the same router answers `503` for the missing webhook secret (AC 5)
Proof: `pnpm --filter @tatame/api exec vitest run --project unit src/api.smoke.test.ts -t "no longer accepts AbacatePay webhook deliveries"`

**C9** - After the full migration set is applied, `information_schema.tables` holds no `pending_pix_payments` in the test schema and still holds `pending_asaas_payments` (AC 6)
Proof: `pnpm --filter @tatame/api exec vitest run --project integration src/migrations.integration.test.ts -t "drops pending_pix_payments and keeps the Asaas table"`

**C10** - `CATALOG["payment.webhook_unhandled"].reasons` equals exactly `NO_PENDING_CHARGE`, `MISSING_REFERENCE`, `DUPLICATE_MONTH`, `FOREIGN_ACCOUNT`, `USER_OR_ACADEMY_NOT_FOUND`, `OWNER_NOT_FOUND`, `UNKNOWN_EVENT_TYPE` — seven reasons, `NO_PENDING_PIX` among none of them (AC 7)
Proof: `pnpm --filter @tatame/api exec vitest run --project unit src/telemetry/events.test.ts -t "no longer accepts the AbacatePay drop reason"`

**C11** - `unpaidPixPerAcademy` reports an unpaid `kind = 'payment'` row inside the window as `count: 1, amountCents: 12000`, and reports neither the settled `payment` row nor the `kind = 'checkout'` row (AC 8, AC 9)
Proof: `pnpm --filter @tatame/api exec vitest run --project integration src/platform-summary.integration.test.ts -t "counts an unpaid Asaas Pix charge, the rail that replaced AbacatePay"`

**C12** - `unpaidPixPerAcademy` reports nothing for an unpaid `kind = 'payment'` row created at 01:00 UTC on the window day, which is 22:00 BRT the day before (AC 8)
Proof: `pnpm --filter @tatame/api exec vitest run --project integration src/platform-summary.integration.test.ts -t "leaves an Asaas charge opened before the BRT day out"`

**C13** - Two academies each holding one unpaid `kind = 'payment'` row get one row each, carrying their own `amountCents` rather than the sum (AC 8)
Proof: `pnpm --filter @tatame/api exec vitest run --project integration src/platform-summary.integration.test.ts -t "keeps each academy's unpaid Pix on its own row"`

**C14** - The harness's `TRUNCATE_ALL` succeeds against the schema the migration set produces, so every integration test reaches its own body (AC 10)
Proof: `pnpm --filter @tatame/api exec vitest run --project integration src/platform-summary.integration.test.ts -t "counts an unpaid Asaas Pix charge, the rail that replaced AbacatePay"`

**C15** - Neither `docs/observability.md` nor the Grafana alerting rules name `NO_PENDING_PIX` (AC 11)
Proof: `bash -c '! git grep -l -e NO_PENDING_PIX -- docs/observability.md infra/observability/grafana/provisioning/alerting/rules.yml'`

**C16** - The repository gate is green: `typecheck`, `lint`, the unit project and the integration project (TAT-187 acceptance gate)
Proof: `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:integration`

**C17** - `unpaidPixPerAcademy` reports nothing for an unpaid `kind = 'payment'` row created at exactly `window.end`, which is 03:00 UTC the day after the BRT day (AC 8)
Proof: `pnpm --filter @tatame/api exec vitest run --project integration src/platform-summary.integration.test.ts -t "leaves an Asaas charge opened at the exact end of the window out"`

> **Added in round 2, from a surviving mutant the Verifier found.** The upper bound
> `lt(createdAt, window.end)` had no asserted case: removing it left C11, C12, C13, all
> eight cases in that file and then the entire 860-test suite green. It is a production
> defect and not only a coverage hole — `collectDay` reads two windows to compare the day
> against the one before it, so with no upper bound both numbers become "everything unpaid
> since `window.start`", grow without bound, and the comparison stops measuring. The same
> silent-wrong class TAT-104 already fixed once in this function. The row in `Coverage`
> went from four predicates to five; the fourth was never a member, which is why the join
> did not catch it and fault injection did.

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /v1/payments/checkout/pix` statuses (1) | `404` C1 | - |
| `GET /v1/payments/pix-status/:pixQrCodeId` statuses (1) | `404` C2 | - |
| `POST /v1/webhooks/abacatepay` statuses (1) | `404` C8 | - |
| one-way doors in the plan's `Landing` (3) | table dropped C9 · routes withdrawn C1, C2, C8 · reason retired C10 | - |
| entities in the plan's `Relations` (2) | `PendingPixPayment` removed C9 · `PendingAsaasPayment` kept C11 | - |
| `unpaidPixPerAcademy` predicates (5) | inside the day window C11 · before `window.start` C12 · at `window.end` C17 · `kind = 'checkout'` excluded C11 · a settled row excluded C11 | - |
| `unpaidPixPerAcademy` grouping (2) | one academy C11 · two academies kept apart C13 | - |
| `payment.webhook_unhandled` reasons after the change (7) | C10, table-driven over all 7 as one array equality | - |
| removal sites naming the provider (14 non-test files) | C3, table-driven over all 14 tracked paths | - |
| removal sites naming the table or its methods (10 non-test files) | C4, table-driven over all 10 tracked paths | - |
| startup config: the assembled app under test (2 assemblies) | `createApp()` in the unit project C1, C8 · `createApp()` plus a migrated schema in the integration project C7, C14 | - |

- Claims naming a status code or a route — C1, C2, C8 — are each proven through the assembled
  app with supertest, so a route that vanished because the router stopped mounting cannot read as
  a route that was removed: each asserts a live sibling on the same router in the same test
- C3 and C4 are the only negative claims here, and both are exhaustive over a tracked path set
  rather than over a list someone wrote down, which is what makes a forgotten file visible
- No other check claims more than the single case its proof exercises

## Test policy

The repo's testing guidance (`docs/superpowers/specs/2026-03-20-api-testing-design.md`) says where
tests live and how they are built — unit with in-memory repositories, integration against a real
Postgres through testcontainers. It answers neither of the two questions, because keying the level
to whether a test uses real dependencies decides *how* to write a test, not what deserves one. So
these rows apply.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, and reachable only through SQL | one at the integration layer against real Postgres | one asserted case per predicate, and one per grouping key arity |
| Entry point that decides nothing — a route's existence | one at the boundary through the assembled app | the path under claim, plus a live sibling on the same router in the same test |
| A closed set declared as data | one direct assertion over the whole collection | array equality, never a membership test, so a removal and an addition both show |
| Instrumentation — a repository method forwarding one query | none of its own | covered by its consumer's proof |

Evidence:

- `platform-summary.repository.postgres.ts#unpaidPixPerAcademy`: before this change, two queries,
  eight predicates and a merge over two result sets; after it, one query, four predicates and one
  `groupBy` -> decides. Its predicates are invisible to any caller, so only the integration layer
  can assert them.
- `payment.routes.ts` removed handlers and the `/webhooks/abacatepay` handler: zero branch points
  once they are gone -> entry point, boundary proof only.
- `telemetry/events.ts` `CATALOG`: a literal table, not code -> asserted directly.
- `payment.repository.postgres.ts` pending-pix trio: each forwards a single drizzle call with no
  conditional -> instrumentation, deleted with its consumer.
- closest analogue in the repo: `platform-summary.integration.test.ts`, which already proves this
  same file's `paymentsPerMethod`, `overduePerAcademy` and BRT-window handling at the integration
  layer with one case per predicate — same code shape, same level, eight passing cases.

Cost: three integration cases on `unpaidPixPerAcademy` (C11 exists, C12 and C13 are new) and two
boundary cases in `api.smoke.test.ts` (C1/C2 rewrite an existing test, C8 is new). Without C12 and
C13 the window predicate and the per-academy grouping on the surviving rail are proven only by a
path that happens to traverse them — which is how this exact function came to report zero once
already.

## Swept

- validation: n/a - the change removes request bodies and adds none; `createCheckoutBodySchema` stays in use by `POST /payments/checkout`
- failure modes: existing - deploy order cannot break in either direction: no live client calls the removed routes (C1, C2, C8) and no surviving code path reads the dropped table (C4)
- idempotency: existing - the drizzle journal applies `0024` once; `drizzle-kit migrate` skips entries already recorded
- authorization: n/a - no route is added and no guard is relaxed; C1 and C8 assert that the live siblings on both routers still answer `503` behind their guards
- concurrency: n/a - the dropped table has no writer left (C4), so the migration's exclusive lock contends with nothing
- data lifecycle: C9 - the table and its production rows are destroyed by `0024`, which is the first `Landing` row and the decision the maintainer confirmed on 2026-10-08
- dependency failure: n/a - this removes the codebase's only AbacatePay call; after C3 there is no remaining request whose failure could be handled
- state transitions: n/a - no state machine changes; `pending_asaas_payments` keeps both `kind` values and C11 asserts each
- observability: C10, C15 - the retired reason leaves the typed catalogue, the alert's LogQL query and the two documents that named it; the query keeps `NO_PENDING_CHARGE|MISSING_REFERENCE`, so the rule keeps firing, and `catalog-coverage.test.ts` fails if the three ever disagree

## Progress

Updated in the commit that closes each check, so a resume after a crash does not redo
finished work.

- **C1, C2, C5, C6, C7, C8, C10** — closed: the AbacatePay code path removed (routes, service
  method, repository trio, webhook handler and its route, the retired event reason, the env
  schema entry)
- **C4, C9, C11, C12, C13, C14** — closed: `pending_pix_payments` dropped by migration `0024`,
  `unpaidPixPerAcademy` reduced to the Asaas query, the harness and seed truncate lists updated
- **C3, C15** — closed: the alert's LogQL query, its email description and
  `docs/observability.md` no longer name the retired reason or the provider
- **C16** — closed: `typecheck` 13/13, `lint` 8/8, unit 730 passed in 42 files, integration 130
  passed in 17 files, all exit 0 at `ea6347c`
- **C17** — closed in round 2: the window's upper bound now has an asserted case at exactly
  `window.end`, which is the one value that separates `lt` from `lte` and both from no bound.
  Gate re-run at `bec7e9b`: `typecheck` 13/13, `lint` 8/8, unit 730 passed in 42 files,
  integration 131 passed in 17 files, all exit 0

**Environment note, not a code finding.** The integration project starts Postgres through
testcontainers, and on this machine Docker Desktop intermittently fails to resolve
`postgres:16-alpine` by tag while `docker images` still lists it and `docker image inspect
<id>` resolves it. When the tag lookup fails, testcontainers concludes the image is absent
and falls through to `Pulling image`, which never returns because the registry is unreachable
here — so the run hangs at startup with no container and no output rather than failing. The
remedy is to confirm `docker image inspect postgres:16-alpine` exits 0 before running the
project, and to retry if it does not. Nothing in this feature touches it.

## Handoff

- S1 = 99 KB -> ~25k, all inside `apps/api/src/modules/payment` plus two comment edits in
  `apps/mobile`; S2 enters `platform-summary`, `packages/db` and the observability docs at
  ~86k total, under the 150k budget — **one builder**, no cut
- The two slices are not independent: S2's migration drops the table S1's code stops writing, so
  S1 lands first and the gate (C16) runs once at the end
