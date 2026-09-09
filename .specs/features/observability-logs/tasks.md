# Observability — Logs Tasks

**Spec**: `.specs/features/observability-logs/spec.md`
**Design**: `.specs/features/observability-logs/design.md`
**Status**: Done — T1–T20 complete. LOG-20 and LOG-21 deferred (P3).

---

## Gate checks

No `.specs/codebase/TESTING.md` exists. Commands inferred from the repo and pinned here so every
task means the same thing by "gate passes":

| Gate | Command | When |
| --- | --- | --- |
| **quick** | `pnpm --filter @tatame/api typecheck && pnpm --filter @tatame/api lint && pnpm --filter @tatame/api test:unit` | Any TypeScript change. `typecheck` runs both `tsconfig.json` and `tsconfig.test.json` since T8 |
| **full** | quick, then `pnpm --filter @tatame/api test:integration` | Changes to middleware, error handling or app wiring. Needs Docker (testcontainers) |
| **infra** | `docker compose -f docker-compose.yml -f docker-compose.observability.yml config` + the task's own curl | Changes under `infra/observability/` or the compose files |
| **build** | `node scripts/build-apm-dashboard.mjs --check` | Dashboard script changes |

Test convention observed in the repo: unit tests are co-located `*.test.ts` (vitest project
`unit`); integration tests are `*.integration.test.ts` (project `integration`, single-threaded,
testcontainers Postgres). `*.routes.ts`, `*.repository.postgres.ts` and workers are excluded from
coverage, so call-site tasks in those files carry no new unit tests by design.

---

## Execution Plan

### Phase 1 — Infrastructure (no application code)

```
T1 ──→ T2 ──→ T3 ──→ T4
```

Sequential because each hop needs the one before it to exist before it can be verified. This is
the phase the previous attempt skipped verifying, so every task here ends with a curl.

### Phase 2 — Application foundation

```
T5 ──→ T6 ──→ T8
T7 ──────────↗
```

`T7` (SDK wiring) is independent of `T5`/`T6` and can run alongside them; `T8` needs both the
logger and a live exporter to be meaningful.

### Phase 3 — Call sites (parallel, one per domain)

```
        ┌→ T9  [P] checkin
        ├→ T10 [P] membership
        ├→ T11 [P] subscription
T8 ─────┼→ T12 [P] payment
        ├→ T13 [P] manager_subscription
        ├→ T14 [P] graduation
        ├→ T15 [P] access
        └→ T16 [P] request.failed
```

Eight independent files-sets, no shared state, no shared test files. Genuinely parallel.

### Phase 4 — Migration, enforcement, docs

```
T17 ──→ T18 ──→ T19 ──→ T20
```

---

## Task Breakdown

### T1: Add Loki to the observability stack

**What**: A `loki` service and its config file, running and ready, storing nothing yet.
**Where**: `infra/observability/loki.yml` (new), `docker-compose.observability.yml`
**Depends on**: None
**Reuses**: The Tempo service block as a shape template — same dev posture (no auth, local disk,
named volume, `restart: unless-stopped`).
**Requirement**: LOG-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `grafana/loki:3.7.2` (design F8), port `3100` published, volume `tatame_loki_data`
- [ ] Single-binary config: `auth_enabled: false`, TSDB schema `v13`, filesystem object store
- [ ] `limits_config.allow_structured_metadata: true` — **OTLP ingestion fails without it** (F7)
- [ ] `limits_config.retention_period: 168h` and `compactor.retention_enabled: true`, matching
      Prometheus and Tempo. Retention without the compactor flag silently never deletes
- [ ] `curl -s localhost:3100/ready` returns `ready`
- [ ] Comment header explains the dev-only posture, same voice as `tempo.yml`

**Tests**: none · **Gate**: infra

---

### T2: Route logs from the Collector to Loki

**What**: A `logs` pipeline in the Collector, exporting over OTLP/HTTP to Loki's native endpoint.
**Where**: `infra/observability/otel-collector-config.yml`
**Depends on**: T1
**Reuses**: The `otlp_grpc/tempo` exporter block and the existing `metrics`/`traces` pipeline shape.
**Requirement**: LOG-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Exporter `otlp_http/loki` → `endpoint: http://loki:3100/otlp`, `tls.insecure: true`
- [ ] **Not** a `loki` exporter — it does not exist in `collector-contrib:0.160.0` (design F1).
      The component is named `otlp_http`, not `otlphttp` (F2)
- [ ] Pipeline `logs`: `receivers: [otlp]`, `processors: [memory_limiter, batch]`,
      `exporters: [otlp_http/loki, debug]`
- [ ] `otel-collector` gains `depends_on: [loki]`
- [ ] The file's header comment ("Logs get their own pipeline here later") is updated — it is now
      describing the present
- [ ] Verified end to end by hand: push one OTLP log record to `:4318/v1/logs` with curl, then
      `curl -s --get localhost:3100/loki/api/v1/query_range --data-urlencode 'query={service_name="probe"}'`
      returns it. **Do not proceed to T3 on a green `docker compose config` alone**

**Tests**: none · **Gate**: infra

---

### T3: Provision the Loki datasource and both trace links

**What**: Grafana reads Loki, and traces and logs link to each other in both directions.
**Where**: `infra/observability/grafana/provisioning/datasources/datasources.yml`
**Depends on**: T2
**Reuses**: The fixed-`uid` convention and the `tracesToMetrics` block already on the Tempo
datasource.
**Requirement**: LOG-06, LOG-08

**Tools**: MCP: `context7` (Grafana provisioning schema) · Skill: NONE

**Done when**:
- [ ] `Loki` datasource, `uid: loki`, `url: http://loki:3100`, `access: proxy`
- [ ] Logs → trace: `derivedFields` on `trace_id`, `datasourceUid: tempo`. **This is the bug
      `62b4051` shipped**: a regex over the log line never matches, because OTLP carries
      `trace_id` as a record field that Loki stores as structured metadata. Use the
      structured-metadata/label matcher, and confirm the exact provisioning key against the
      Grafana docs rather than assuming the spelling (design, open question 1)
- [ ] Trace → logs: `tracesToLogsV2` on the Tempo datasource → `datasourceUid: loki`
- [ ] **Both links clicked in the browser against a real record.** Not "the YAML parses" —
      clicked. The previous attempt's failure was exactly that nobody did
- [ ] `docker compose logs grafana | grep -i "datasource"` shows no provisioning error

**Tests**: none · **Gate**: infra

---

### T4: Un-collapse the APM dashboard's Logs row

**What**: The two parked Loki panels become visible and return data.
**Where**: `scripts/build-apm-dashboard.mjs`, regenerating
`infra/observability/grafana/dashboards/otel-service-apm.json`
**Depends on**: T3
**Reuses**: The `section(title, children, { collapsed })` helper at :260.
**Requirement**: LOG-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `section("Logs", [], { collapsed: true })` at :304 becomes `collapsed: false`
- [ ] The `visibleLoki` guard at :320 inverts: it currently throws when a Loki panel is visible,
      which is now the desired state. It should assert the panels *are* present instead
- [ ] The header comment at :57 and the banner text at :137 stop saying Loki is not deployed
- [ ] `node scripts/build-apm-dashboard.mjs && node scripts/build-apm-dashboard.mjs --check` both pass
- [ ] Both log panels render data in Grafana after `pnpm load-test`

**Tests**: none · **Gate**: build + infra

---

### T5: Extract redaction into a shared, import-free module

**What**: Move `isSensitive`/`segments`/`redact`/`serialize` out of `error-capture.ts`.
**Where**: `apps/api/src/telemetry/redact.ts` (new), `redact.test.ts` (new),
`error-capture.ts`, `error-capture.test.ts`
**Depends on**: None
**Reuses**: The existing implementation verbatim — this is a move, not a rewrite.
**Requirement**: LOG-15

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `redact.ts` has **zero imports**. This is load-bearing: `error-capture.ts` is imported by
      `instrumentation.ts` before Express, and its "no runtime imports" rule only survives if
      what it imports is itself import-free
- [ ] `serialize` takes `maxChars` as a parameter (default 2048) so the logger can cap differently
- [ ] Redaction tests move to `redact.test.ts`, including the `apiKey`-redacted /
      `monkey`-not-redacted pair — that list already broke once in exactly that direction
- [ ] `error-capture.test.ts` keeps its capture/hook tests and still passes
- [ ] Test count before and after is equal or higher — no silent deletions

**Tests**: unit · **Gate**: quick

---

### T6: The logger

**What**: `log.debug/info/warn/error/child` — stdout always, OTLP when the SDK is on.
**Where**: `apps/api/src/telemetry/logger.ts` (new), `logger.test.ts` (new)
**Depends on**: T5
**Reuses**: `redact.ts`; the `[prefix]` + context-object shape already used at 69 call sites.
**Requirement**: LOG-09, LOG-10, LOG-03

**Tools**: MCP: `context7` (`@opentelemetry/api-logs`) · Skill: NONE

**Done when**:
- [ ] Imports `@opentelemetry/api-logs` only — **never** `@opentelemetry/sdk-logs` or the SDK.
      One global provider, owned by `NodeSDK` (design, "What the previous attempt got wrong")
- [ ] Writes to stdout unconditionally: JSON per line when not a TTY, short human line when `isTTY`
- [ ] Emits to `logs.getLogger("tatame-api")` on every call; severity 5/9/13/17
- [ ] `fields.err` becomes `exception.type` / `.message` / `.stacktrace`
- [ ] `fields` passes through `redact()` before either sink
- [ ] Silent under `NODE_ENV=test` unless `LOG_LEVEL` is set
- [ ] **Every public method wraps its body in try/catch.** Unit test: a field whose getter throws
      must not propagate. A logger that can fail a request is the one unacceptable outcome (LOG-10)
- [ ] Unit test: with no global provider registered, every method still writes to stdout and
      does not throw — this is the `pnpm api:dev`-without-the-stack path

**Tests**: unit · **Gate**: quick

---

### T7: Wire log export into the SDK

**What**: `logRecordProcessors` on `NodeSDK`, gated like traces.
**Where**: `apps/api/src/instrumentation.ts`, `apps/api/package.json`,
`packages/config/src/env.ts`, `.env.example`
**Depends on**: None
**Reuses**: The existing `OTEL_TRACES_ENABLED` gate and the `else` branch that already checks
`OTEL_COLLECTOR_URL` and `NODE_ENV`.
**Requirement**: LOG-01, LOG-02, LOG-11

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `@opentelemetry/sdk-logs`, `@opentelemetry/exporter-logs-otlp-grpc`,
      `@opentelemetry/api-logs` promoted to direct deps at `0.222.0` — already in the lockfile
      transitively, so no new resolution
- [ ] `logRecordProcessors: [new BatchLogRecordProcessor(new OTLPLogExporter({ url: collectorUrl }))]`
      when `OTEL_LOGS_ENABLED !== "false"`
- [ ] When disabled, the key is **omitted** — no `[]` counterpart is needed here, unlike
      `spanProcessors`. There is no `OTEL_LOGS_EXPORTER` default that would ship logs unasked
- [ ] Boot line printed, matching the existing two: `[otel] logs exporting to <url>` /
      `[otel] OTEL_LOGS_ENABLED=false — logs disabled`
- [ ] `flushTelemetry()` unchanged — `sdk.shutdown()` already awaits the logger provider (F3).
      Confirm by reading `sdk.js`, do not add a second flush
- [ ] `OTEL_LOGS_ENABLED` and `LOG_LEVEL` added to the env schema and `.env.example`
- [ ] `apps/api/vitest.config.ts`: delete the stale `src/lib/logger.ts` coverage exclude — that
      file was removed in `62b4051` and the new logger is tested

**Tests**: none (bootstrap file, excluded from coverage) · **Gate**: quick

---

### T8: The typed event catalog

**What**: `CATALOG` + `emitEvent`, with `reason` constrained per event.
**Where**: `apps/api/src/telemetry/events.ts` (new), `events.test.ts` (new)
**Depends on**: T6, T7
**Reuses**: `logger.ts`; `HttpError.details.code` as the natural source of reason codes;
`Role` from `@tatame/types`.
**Requirement**: LOG-12, LOG-14

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Every event from the spec's catalog table has a `CATALOG` entry, `as const satisfies`
- [ ] `emitEvent` makes `reason` **required** where the entry declares `reasons`, **forbidden**
      where it does not, and accepts only that entry's strings
- [ ] Type-level tests with `@ts-expect-error` covering all four cases: valid, missing required
      reason, forbidden reason, wrong reason for the domain. `@ts-expect-error` fails the build
      when the error stops occurring, which is what makes these real tests
- [ ] `EventFields` is closed — no index signature. `extra` is the only escape hatch
- [ ] Field-to-attribute mapping: `userId` → `user.id`, `actorRole` → `app.actor.role`,
      `academyId` → `app.academy.id`, and so on per the design's data model
- [ ] `event.name` written to both the native `eventName` field and an attribute. **Settled at
      T2: Loki drops the native field**, so the attribute is mandatory — see spec.md, "Found
      during implementation". Keep the native field with a comment saying why it is not enough
- [ ] Unit test: no field named `email`, `name`, `phone`, `cpf` or `document` survives
      `emitEvent` (LOG-14)

**Tests**: unit · **Gate**: quick

---

### T9–T16: Emit the events [P]

Eight independent tasks, same shape. Each: add `emitEvent` calls to one domain, on success,
rejection and failure; map each existing `HttpError` throw to its catalog reason; no behaviour
change beyond the emission.

**Depends on**: T8 · **Requirement**: LOG-13 · **Tools**: MCP: NONE · Skill: NONE

| # | Domain | Where | Notes | Tests | Gate |
| --- | --- | --- | --- | --- | --- |
| T9 [P] | `checkin` | `modules/checkin/checkin.service.ts`, `checkin.routes.ts` | The richest case — eight reasons, and the ones inside `withCheckinLock` must emit before the lock releases. `CheckinLockBusyError` → `LOCK_BUSY`, unique violation → `DUPLICATE` | unit | quick |
| T10 [P] | `membership` | `modules/membership/membership.routes.ts` | Six events, all state transitions. No service file — emit at the route | none | quick |
| T11 [P] | `subscription` | `modules/subscription/subscription.{service,routes}.ts` | `plan_assigned` carries the plan id in `extra` | unit | quick |
| T12 [P] | `payment` | `modules/payment/payment.{service,routes}.ts` | `checkout_started` covers both `/checkout` and `/checkout/pix`; distinguish via `extra.method` | unit | quick |
| T13 [P] | `manager_subscription` | `modules/manager-subscription/stripe-subscription-webhook.handler.ts` | Replaces 12 `console.*` — the single densest cluster. `webhook_unhandled` replaces the `unhandled event type` log. Overlaps T17; **T17 must skip this file** | none | quick |
| T14 [P] | `graduation` | `modules/graduation/graduation.{service,routes}.ts` | `assertValidPromotion` throws → `INVALID_PROMOTION` | unit | quick |
| T15 [P] | `access` | `middleware/{require-session,authorize,require-active-plan,require-plan-feature}.ts`, `app.ts` | Five reasons. `RATE_LIMITED` needs an `express-rate-limit` `handler`, since the limiter answers without touching our middleware | none | full |
| T16 [P] | `request` | `middleware/error-handler.ts` | `request.failed` on the unhandled branch only — the same branch that already calls `recordAppError`. Replaces its `console.error`. The 4xx branches above are expected outcomes and stay silent | none | full |

**Done when** (each):
- [ ] Every catalog event for the domain has at least one call site
- [ ] Every existing `HttpError` throw in the domain maps to a reason, or is deliberately not an event
- [ ] Existing tests still pass at the same count or higher
- [ ] No behaviour change: same status codes, same bodies

---

### T17: Migrate the remaining `console.*` calls

**What**: The ~57 `console.*` not already replaced in T9–T16 become logger calls.
**Where**: `modules/notification/*` (14), `modules/engagement/*` (7), `modules/email/email.worker.ts` (3),
`server.ts` (8), `lib/redis.ts` (1), `migrate.ts` (1), `manager-subscription.routes.ts` (1)
**Depends on**: T9–T16
**Reuses**: `logger.ts`; the `[prefix]` already at each call site.
**Requirement**: LOG-16, LOG-18

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `[push]`, `[engagement]`, `[email]`, `[dispatcher]`, `[bull-board]` become a structured
      field (`component`), not string-prefixed prose
- [ ] Worker logs carry job name and id (LOG-18) — `email.worker.ts`, `notification.worker.ts`
      and `engagement.worker.ts` already have both in scope at the `Job failed` sites
- [ ] `stripe-subscription-webhook.handler.ts` is **not** touched here — T13 owns it
- [ ] `instrumentation.ts`, `seed.ts` and `*.test.ts` keep their `console.*` (design decision)
- [ ] `grep -rn "console\." apps/api/src --include="*.ts" | grep -v test` returns only
      `instrumentation.ts` and `seed.ts`
- [ ] No message text is lost or reworded — this is a transport change, not an editing pass

**Tests**: none (workers excluded from coverage) · **Gate**: full

---

### T18: Enforce it with lint

**What**: `no-console` as an error, with the three documented exceptions.
**Where**: `apps/api/eslint.config.js`
**Depends on**: T17
**Reuses**: The existing per-glob override blocks — the config already scopes rules to
`**/*.test.ts` and `**/*.mjs`.
**Requirement**: LOG-17

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `"no-console": "error"` for `**/*.ts`
- [ ] Turned off for `**/*.test.ts`, `src/seed.ts`, `src/instrumentation.ts`, each with a comment
      saying why — the reasons are not obvious six months from now
- [ ] `pnpm --filter @tatame/api lint` passes clean
- [ ] Verified negatively: add a `console.log` to a route, confirm lint fails, remove it

**Tests**: none · **Gate**: quick

---

### T19: Document it

**What**: `docs/observability.md` covers logs the way it already covers metrics and traces.
**Where**: `docs/observability.md`
**Depends on**: T18
**Reuses**: The document's existing structure — data path diagram, port table, env var table,
"Verifying each hop", "Files".
**Requirement**: LOG-19

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] **The "Adding Loki next" section is replaced, not appended to.** Its step 2 is wrong: there
      is no `loki` exporter in `collector-contrib:0.160.0` (design F1). Leaving it would document
      a component that does not exist
- [ ] The ASCII data path, the port table (`3100`) and the env var table (`OTEL_LOGS_ENABLED`,
      `LOG_LEVEL`) all include logs
- [ ] "Verifying each hop" gains the log hops, in the same one-curl-per-hop style
- [ ] A new section documents the event catalog: the record shape, the LogQL for the common
      questions, and **how to add an event** — one `CATALOG` entry plus one call site
- [ ] Explicit: index labels vs. structured metadata, and why `event.domain` is not a label (F6)
- [ ] Explicit: 7-day retention, and that this is **not** an audit trail
- [ ] The "Files" table lists `loki.yml`, `logger.ts`, `events.ts`, `redact.ts`

**Tests**: none · **Gate**: none

---

### T20: Verify the whole path, hop by hop

**What**: Prove the feature works end to end, and settle the design's open questions.
**Where**: No files — a verification pass. Findings go into `spec.md` under a
"Found during implementation" section, matching the traces spec's convention.
**Depends on**: T19
**Reuses**: `pnpm load-test`; the "Verifying each hop" method the docs already teach.
**Requirement**: All

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Stack up, `pnpm load-test` run, then each hop confirmed: API boot line → Collector received
      → Loki stored → Grafana queries
- [ ] `{service_name="tatame-api"}` returns records; index labels are exactly the four expected
      (LOG-07) — check with `curl -s localhost:3100/loki/api/v1/labels`
- [ ] A rejected check-in produces `event_reason="CLASS_FULL"`, found by LogQL alone
- [x] ~~Trace → logs and logs → trace resolving to a real trace (LOG-08)~~ — settled at T8
- [ ] The APM dashboard's two log panels render data — deferred from T4, needs `var-service_name`
      to resolve, which needs the API running
- [ ] ~~Open questions 2 and 3~~ — both settled at T2, written up in spec.md
- [ ] With the stack **stopped**, `pnpm api:dev` boots and serves normally, logs to the terminal,
      and prints `[otel] OTEL_COLLECTOR_URL not set — telemetry disabled`
- [ ] `OTEL_LOGS_ENABLED=false` disables logs while metrics and traces keep flowing
- [ ] Findings written up in `spec.md`

**Tests**: none · **Gate**: full + infra

---

## Deferred to a later cut

Specified but not scheduled here — LOG-20 and LOG-21 are P3, and both are better shaped by real
event volume than by guesswork now.

| Requirement | What |
| --- | --- |
| LOG-20 | The five P2-tier domains: `announcement`, `class`, `academy`, `dependent`, `user` |
| LOG-21 | The `Tatame — domain events` dashboard |

---

## Pre-approval checks

### Check 1 — Granularity

| Task | Deliverable | Atomic? |
| --- | --- | --- |
| T1 | One service + one config file | Yes |
| T2 | One pipeline in one file | Yes |
| T3 | One datasource + two link blocks in one file | Yes |
| T4 | One script change | Yes |
| T5 | One module extraction | Yes |
| T6 | One module | Yes |
| T7 | One bootstrap change | Yes |
| T8 | One module | Yes |
| T9–T16 | One domain each | Yes |
| T17 | One mechanical migration | Yes — wide but single-purpose |
| T18 | One lint rule | Yes |
| T19 | One document | Yes |
| T20 | One verification pass | Yes |

### Check 2 — Diagram / definition cross-check

| Task | `Depends on` | In diagram | Match |
| --- | --- | --- | --- |
| T1 | None | Phase 1 root | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | None | Phase 2 root | ✅ |
| T6 | T5 | T5 → T6 | ✅ |
| T7 | None | Phase 2 root | ✅ |
| T8 | T6, T7 | T6 → T8, T7 → T8 | ✅ |
| T9–T16 | T8 | T8 → each, `[P]` | ✅ |
| T17 | T9–T16 | Phase 3 → T17 | ✅ |
| T18 | T17 | T17 → T18 | ✅ |
| T19 | T18 | T18 → T19 | ✅ |
| T20 | T19 | T19 → T20 | ✅ |

### Check 3 — Test co-location

| Task | Creates | Required | Declared | Match |
| --- | --- | --- | --- | --- |
| T1–T4 | Infra config | none | none + curl | ✅ |
| T5 | `telemetry/*.ts` | unit | unit | ✅ |
| T6 | `telemetry/*.ts` | unit | unit | ✅ |
| T7 | Bootstrap (excluded from coverage) | none | none | ✅ |
| T8 | `telemetry/*.ts` | unit | unit | ✅ |
| T9, T11, T12, T14 | `*.service.ts` | unit | unit | ✅ |
| T10, T13 | `*.routes.ts`, webhook handler (both excluded) | none | none | ✅ |
| T15, T16 | Middleware | integration | full gate | ✅ |
| T17 | Workers (excluded) | none | none | ✅ |
| T18–T20 | Config, docs, verification | none | none | ✅ |
