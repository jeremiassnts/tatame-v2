# Feature: Logs (Loki) + domain event catalog

**Status:** Specified
**Branch:** `feat/observability-rework`
**Builds on:** `.specs/features/observability-metrics`, `.specs/features/observability-traces`

## Problem Statement

The stack answers *how many* (Prometheus) and *where the time went* (Tempo), but not *what
happened*. Today the API's only narrative is 69 loose `console.*` calls that vanish with the
terminal: a Stripe subscription webhook writes seven different `console.log` lines that nobody
can query, and a rejected check-in leaves no trace at all beyond a 409 status code.

Two things are missing, and they are not the same thing:

1. **A log store.** Loki, fed through the Collector like every other signal, correlated to the
   traces already in Tempo.
2. **A vocabulary.** Named, structured events for the actions that matter to the business —
   `checkin.rejected` with a reason, not `"Aula lotada"` in a 500 response — so questions like
   "quantos check-ins foram recusados por limite semanal esta semana?" have an answer.

Without (2), (1) is just `grep` with extra infrastructure.

## Goals

- [ ] Every log line the API writes reaches Loki, carrying `trace_id` so Grafana can jump from
      a slow trace to its logs and back.
- [ ] The core business actions of the API emit named events with a stable shape, queryable by
      domain, outcome and reason.
- [ ] Errors are findable by *why*, not only by status code — a rejection reason is a first-class
      field, not prose inside a message.
- [ ] Zero `console.*` left in `apps/api/src` (outside tests), enforced by lint.
- [ ] Local dev keeps working with no collector running: logs still print to the terminal.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Background workers as *named events* | The user scoped the catalog to request-path domain actions. Workers still get structured logs and reach Loki (LOG-06) — they just do not define `event.name`s in this iteration |
| Logs from `apps/web` and mobile | Same boundary the metrics and traces specs drew: `apps/api` only |
| An audit table in Postgres | Loki is the store for this iteration. A durable, queryable audit trail is a product feature, not observability |
| Alerting / Grafana alert rules on log volume | Needs a baseline first. Defer until the events have been running long enough to know what normal looks like |
| Log-derived metrics (`loki.metrics`, recording rules) | The counters that matter are already Prometheus metrics or can be added there directly |
| Replacing `app.error.body` on spans | It answers a different question (what did this one request return) and stays as is |
| Tail sampling / log sampling | Dev-scale volume. Revisit with real traffic |

---

## User Stories

### P1: Logs land in Loki, correlated to traces ⭐ MVP

**User Story**: As the developer on call, I want the API's logs in Grafana next to its traces,
so that I can go from "this request was slow / failed" to "here is what the code said while it
happened" without leaving the tab.

**Why P1**: Nothing else in this feature is observable until the pipe exists. It is also the
half the APM dashboard is already built for — the Loki panels are sitting in a collapsed row
waiting for a datasource.

**Acceptance Criteria**:

1. WHEN the API emits a log record and `OTEL_COLLECTOR_URL` is set THEN the record SHALL be
   exported over OTLP/gRPC to the Collector and stored in Loki.
2. WHEN a log record is emitted inside an active span THEN it SHALL carry that span's `trace_id`
   and `span_id`.
3. WHEN `OTEL_COLLECTOR_URL` is unset, or `NODE_ENV=test`, or `OTEL_LOGS_ENABLED=false` THEN the
   API SHALL export no logs and SHALL still print them to stdout.
4. WHEN Loki is unreachable THEN the API SHALL continue serving requests, and the failure SHALL
   NOT surface as a request error.
5. WHEN the APM dashboard is opened THEN its `Logs` row SHALL be expanded and its two panels
   SHALL return data.

**Independent Test**: `curl localhost:3100/ready`, hit `/v1/health`, then run
`{service_name="tatame-api"}` in Grafana Explore and see the request's log lines; click a trace
in Tempo and follow it to its logs.

---

### P1: Core domain actions emit named events ⭐ MVP

**User Story**: As the person running the academy product, I want the actions that matter —
check-in, matrícula, pagamento, assinatura, graduação — to leave a queryable record with a
reason attached, so that I can tell what the API is actually doing and why it refuses things.

**Why P1**: This is the ask. The story above is the delivery mechanism; this is the payload. It is
listed second only because it cannot be tested before the pipe exists.

**Acceptance Criteria**:

1. WHEN a core domain action succeeds THEN the API SHALL emit one log record with
   `event.name`, `event.domain`, `event.outcome="success"` and the action's subject IDs.
2. WHEN a core domain action is refused for a business reason THEN the API SHALL emit one record
   with `event.outcome="rejected"` and a low-cardinality `event.reason` code.
3. WHEN a core domain action fails unexpectedly THEN the API SHALL emit one record with
   `event.outcome="failed"`, severity `ERROR`, and the error's message and stack.
4. WHEN an event carries an actor THEN it SHALL include the internal `user.id` and the actor's
   academy role — never name, email, phone, token or document number.
5. WHEN the same request emits an event THEN that event SHALL share the `trace_id` of the HTTP
   server span, so a trace and its events are one click apart.
6. WHEN `event.name` is chosen THEN it SHALL come from a closed, typed catalog — an arbitrary
   string SHALL NOT compile.

**Independent Test**: Run `pnpm load-test`, then POST a check-in past the class window and query
`{service_name="tatame-api"} | event_domain="checkin"` in Grafana; the record names
`WINDOW_CLOSED`.

---

### P2: The `console.*` calls become structured logs

**User Story**: As a developer, I want one logging path in the API, so that a message written in
a Stripe webhook handler is as findable as one written in a route.

**Why P2**: The pipe and the catalog deliver the value; this makes the rest of the codebase stop
leaking. Mechanical, wide, and safe to do after the shape is settled.

**Acceptance Criteria**:

1. WHEN any code under `apps/api/src` (outside `*.test.ts`, `seed.ts` and `instrumentation.ts`)
   writes a log THEN it SHALL go through the logger.
2. WHEN a `console.*` call is added under `apps/api/src` THEN `pnpm lint` SHALL fail.
3. WHEN a message is migrated THEN its existing `[prefix]` SHALL become a structured field, not
   remain string-prefixed prose.
4. WHEN the logger is used from a worker (email, push, engagement) THEN the record SHALL carry
   the job name and id, and SHALL reach Loki like any other record.

**Independent Test**: `grep -rn "console\." apps/api/src --include="*.ts" | grep -v test` returns
only the allowed files; `pnpm lint` fails on a deliberately added `console.log`.

---

### P3: A Grafana dashboard for the event catalog

**User Story**: As the product owner, I want a dashboard that shows the volume of each domain
action and the top rejection reasons, so that I can see the business through the API.

**Why P3**: Grafana Explore already answers these with LogQL once P1 and P2 land. The dashboard
is convenience, and it is worth building only after real event volume exists to shape it.

**Acceptance Criteria**:

1. WHEN the dashboard is opened THEN it SHALL show event rate by domain, rejection reasons ranked,
   and the most recent `failed` events.
2. WHEN a panel is clicked THEN it SHALL link through to the matching trace.

---

## Edge Cases

- WHEN the Collector is down at API boot THEN startup SHALL NOT block or crash; export retries in
  the background.
- WHEN a log record is emitted outside any span (boot, worker tick, cron) THEN it SHALL be
  exported without `trace_id` rather than dropped.
- WHEN the API shuts down THEN pending log records SHALL be flushed alongside metrics and traces
  in `flushTelemetry()`.
- WHEN an event's context object contains a key that looks sensitive THEN its value SHALL be
  redacted using the same rules as `telemetry/error-capture.ts`.
- WHEN an event's context object is large or cyclic THEN it SHALL be truncated / depth-capped
  rather than throwing inside the logger.
- WHEN the logger itself throws THEN the failure SHALL be swallowed: a broken log line must never
  fail the request that produced it.
- WHEN `NODE_ENV=test` THEN the logger SHALL stay silent by default, so test output is not buried.

---

## The event catalog

Scoped to the request path, as decided. Domains and their events:

| Domain | Events | Rejection reasons that matter |
| --- | --- | --- |
| `checkin` | `checkin.created`, `checkin.rejected` | `NOT_A_STUDENT`, `NO_ACTIVE_MEMBERSHIP`, `CLASS_NOT_FOUND`, `WINDOW_CLOSED`, `CLASS_FULL`, `WEEKLY_LIMIT_REACHED`, `DUPLICATE`, `LOCK_BUSY` |
| `membership` | `membership.requested`, `membership.approved`, `membership.rejected`, `membership.blocked`, `membership.unblocked`, `membership.left` | — |
| `subscription` | `subscription.plan_assigned`, `subscription.plan_created`, `subscription.plan_updated` | — |
| `payment` | `payment.created`, `payment.checkout_started`, `payment.confirmed`, `payment.transferred` | — |
| `manager_subscription` | `manager_subscription.checkout_started`, `.activated`, `.canceled`, `.past_due`, `.trial_ending`, `.webhook_unhandled` | — |
| `graduation` | `graduation.initial_set`, `graduation.promoted` | `INVALID_PROMOTION` |
| `access` | `access.denied` | `NO_SESSION`, `ROLE_FORBIDDEN`, `PLAN_REQUIRED`, `FEATURE_LOCKED`, `RATE_LIMITED` |
| `request` | `request.failed` | — (unhandled 5xx; carries the stack) |

P2-tier domains, same shape, added once the eight above are proven: `announcement`, `class`,
`academy`, `dependent`, `user`.

**Record shape** (attribute names follow OTel semconv where one exists):

| Field | Example | Notes |
| --- | --- | --- |
| `event.name` | `checkin.rejected` | Closed catalog, typed |
| `event.domain` | `checkin` | Derived from the name; structured metadata, queried with `| event_domain="checkin"` |
| `event.outcome` | `success` \| `rejected` \| `failed` | |
| `event.reason` | `CLASS_FULL` | Only on `rejected`/`failed`. Screaming snake, closed set |
| `user.id` | `usr_...` | Internal id. Never email or name |
| `app.actor.role` | `student` | |
| `app.academy.id`, `app.class.id`, … | | Subject ids, per domain |
| `trace_id`, `span_id`, severity, timestamp | | Automatic |

---

## Requirement Traceability

| ID | Requirement | Story | Status |
| --- | --- | --- | --- |
| LOG-01 | The API exports log records over OTLP/gRPC to the Collector, on the same `OTEL_COLLECTOR_URL` as metrics and traces | P1 | Pending |
| LOG-02 | Logs follow the existing opt-in rules (off without `OTEL_COLLECTOR_URL`, off under `NODE_ENV=test`) and can be disabled on their own via `OTEL_LOGS_ENABLED=false` | P1 | Pending |
| LOG-03 | Log records emitted inside a span carry `trace_id` and `span_id`; records outside a span are still exported | P1 | Pending |
| LOG-04 | The Collector routes logs to Loki; adding Loki requires no application change beyond LOG-01 | P1 | Pending |
| LOG-05 | Loki runs in `docker-compose.observability.yml` — dev-only, no auth, local filesystem, 7-day retention to match Prometheus and Tempo | P1 | Pending |
| LOG-06 | Grafana has a provisioned `loki` datasource; the APM dashboard's `Logs` row is expanded and its panels return data | P1 | Pending |
| LOG-07 | Loki index labels stay low cardinality — only the resource attributes Loki promotes by default (`service.name`, `service.namespace`, `service.instance.id`, `deployment.environment.name`). Every per-record field, `event.domain` included, is structured metadata | P1 | Pending |
| LOG-08 | Trace-to-logs and logs-to-trace navigation works in Grafana in both directions | P1 | Pending |
| LOG-09 | A logger module exposes level-based logging and always writes to stdout, whether or not export is on | P1 | Pending |
| LOG-10 | Logging never fails a request: export errors, serialization errors and logger bugs are swallowed | P1 | Pending |
| LOG-11 | `flushTelemetry()` flushes pending log records on shutdown | P1 | Pending |
| LOG-12 | A typed, closed event catalog defines every `event.name`, `event.domain` and `event.reason`; an unlisted value does not compile | P1 | Pending |
| LOG-13 | The eight P1-tier domains emit their catalog events on success, rejection and failure | P1 | Pending |
| LOG-14 | Events carry internal IDs and the actor's role; name, email, phone, document and credentials are never logged | P1 | Pending |
| LOG-15 | Event context is redacted, depth-capped and size-capped, reusing the rules in `telemetry/error-capture.ts` | P1 | Pending |
| LOG-16 | Every `console.*` under `apps/api/src` is migrated to the logger, except tests, `seed.ts` and `instrumentation.ts` | P2 | Pending |
| LOG-17 | `no-console` is enforced by ESLint for `apps/api/src`, with those exceptions | P2 | Pending |
| LOG-18 | Worker logs carry job name and id | P2 | Pending |
| LOG-19 | `docs/observability.md` documents the log path, the catalog, the new ports/vars, and how to add an event | P2 | Pending |
| LOG-20 | The five P2-tier domains emit their events | P3 | Pending |
| LOG-21 | A `Tatame — domain events` dashboard shows rate by domain, top rejection reasons and recent failures | P3 | Pending |

**Coverage:** 21 requirements — 15 P1, 4 P2, 2 P3.

---

## Found during implementation

Not design choices — things the stack turned out to do, each verified against a live run.
Same convention as the traces spec.

- **Loki drops the native OTLP `eventName` field** (design open question 2, settled at T2). A
  record pushed with `"eventName": "probe.native_event_name"` and no matching attribute comes
  back from Loki carrying only `detected_level`, `scope_name`, `service_name`, `severity_number`
  and `severity_text` — the event name is gone. So the `event.name` **attribute is mandatory**,
  not the belt-and-braces the design called it. `events.ts` still writes the native field too: it
  is one line, it is where semconv says the value belongs, and it costs nothing if a future
  backend reads it. Queries use the attribute.

- **`detected_level` works with no extra configuration** (open question 3, settled at T2). Loki
  3.7.2 derived `detected_level: "info"` from `severityNumber: 9` on the first probe record.
  `discover_log_levels` did not need enabling and severity-attribute filtering is not needed.

- **The index labels are exactly the resource attributes, confirming F6.** After ingesting probe
  records carrying `event.domain` and `event.name` as attributes,
  `curl -s localhost:3100/loki/api/v1/labels` returns `service_name`, `service_namespace` and
  `deployment_environment_name` — and nothing else. `event_domain` is structured metadata, as
  designed. (`service_instance_id` will appear as a fourth label once the API reports it; the
  probes did not send one.)

  A caveat on reading query output: Loki's `query_range` response merges index labels and
  structured metadata into one `stream` object, so it *looks* like everything became a label.
  It did not — `/labels` is the honest answer, and `totalStructuredMetadataBytesProcessed` in
  the query stats is the tell.

- **`OTEL_LOGS_ENABLED=false` needed `logRecordProcessors: []`, not an omitted key** (T7). The
  design claimed logs had no env fallback and so needed no counterpart to the trace side's
  `spanProcessors: []`. That was wrong. `configureLoggerProviderFromEnv` in `sdk.js` treats an
  empty `OTEL_LOGS_EXPORTER` as `otlp` and defaults the protocol to `http/protobuf` — so omitting
  the key would have exported logs to `localhost:4318`, which in this stack is the Collector's own
  OTLP HTTP port. Turning logs "off" would have kept shipping them over a different protocol.

  Found by a boot smoke test, not by review: with logs disabled the global provider came back as a
  real `LoggerProvider` instead of the `ProxyLoggerProvider` seen when the SDK is off entirely,
  and that discrepancy was the tell. Verified by emitting a marked record in both modes and
  querying Loki — the disabled one does not arrive, the enabled one does.

- **The APM dashboard's `loki_datasource` variable resolved on its own**, as the traces spec
  predicted under D3/R9: opening the dashboard produced `var-loki_datasource=loki` with no change
  to the dashboard JSON. The variable matches by datasource *type*.

- **The upstream logs panel's `line_format` already expects this design's attribute names.** It
  reads `.level`/`.severity_text`, `.service_instance_id`, `.scope_name`, `.trace_id`,
  `.exception_type` and `.exception_message` — every one of which the logger and event catalog
  produce. Only `.thread_name` goes unused, and it is JVM-only.

- **Two Phase 1 checks could not be completed and moved to T20**, both for the same reason: the
  API does not emit logs until Phase 2, and it was not running.
  - *The trace link resolves to a trace.* The link itself was verified in the browser — Grafana
    renders `View trace` on the log row and builds
    `queryType=traceql&query=<trace_id>` against the `tempo` datasource, which is the mechanism
    `62b4051` got wrong. What could not be checked is that the id lands on a real span.
  - *The dashboard's log panels render.* The dashboard's service picker is built on
    `label_values(target_info, service_name)`, so with the API stopped `var-service_name`
    resolves empty and every panel below reads "No data" — pre-existing behaviour, not caused by
    un-collapsing the row. The panel's exact LogQL was instead run directly against Loki and
    returned the probe record, so the query is right; only the variable was missing.

- **`tsc --noEmit` never sees a test file, so the `@ts-expect-error` contract was inert** (T8).
  `apps/api/tsconfig.json` excludes `src/**/*.test.ts`. An unchecked `@ts-expect-error` asserts
  nothing — LOG-12 had no gate at all, and the gap was only found by deliberately deleting a
  directive and watching the build stay green. `apps/api/tsconfig.test.json` now typechecks
  `src/telemetry/**`, and `pnpm typecheck` runs it. Verified the way it should have been the first
  time: removing the directive now fails with
  `Argument of type '{ userId: string; }' is not assignable to ... { reason: "NOT_A_STUDENT" | ... }`.

  Scoped to `src/telemetry` rather than every test because widening it surfaces **five pre-existing
  type errors** in files this feature does not touch: three in `src/testing/factories/index.ts`
  (`dependentId?: string | null` supplied where `dependentId: string | null` is required) and one
  each in `checkin.integration.test.ts` and `membership.service.test.ts`. Worth fixing — the
  factories one means a factory can build an object missing a required field — but not this
  feature's to change.

- **Phase 2 verified end to end** (T8). A probe emitting two catalog events and one worker-style
  error inside a real span produced, in Loki: `event_domain=checkin`, `event_outcome=rejected`,
  `event_reason=CLASS_FULL`, `user_id=usr_probe`, severity `WARN` for the rejection and `INFO` for
  the success — and `trace_id=1aac6309…`, which `GET /api/traces/1aac6309…` resolves in Tempo to
  the span `POST /v1/checkins`. That closes the T3 check deferred from Phase 1: the correlation is
  real in both directions, not just structurally wired.

- **`payment.failed` was dropped from the catalog** (T12). Both payment webhook handlers
  (`stripe-checkout-webhook.handler.ts`, `abacatepay-webhook.handler.ts`) return early on any
  event other than the success one, so there is no student-payment failure path to report. An
  event that can never fire is worse than a missing one: it reads as coverage.

  Worth flagging separately, as a gap this feature does not close: those early returns are
  silent. A webhook arriving for an unknown pix QR code, or a `checkout.session.completed`
  missing its metadata, produces no record at all. `manager_subscription.webhook_unhandled`
  covers the equivalent case on the Stripe subscription side; the payment handlers have no
  equivalent yet.

- **`access.denied` lost its `FEATURE_LOCKED` reason** (T15), for the same reason
  `payment.failed` went: `requirePlanFeature` calls `next()` unconditionally, so nothing can be
  refused for a locked feature. The reason comes back when that middleware starts enforcing.

- **A catalog-coverage test now guards against exactly this class of mistake** (end of Phase 3).
  `src/telemetry/catalog-coverage.test.ts` scans every non-test source file under `src` for each
  event name and reason string, and fails when one is declared but never emitted — 47 assertions,
  one per entry. It is a text scan on purpose: asserting emission from each service's own unit
  test would mean `vi.resetModules` and env stubbing across eight files to check a string this
  checks directly. Verified negatively by adding a `request.never_emitted` entry and watching it
  fail.

### T20 — the whole path, against a running API

Stack up, `pnpm api:dev`, `pnpm load-test --rps 15 --duration 20` (299 requests).

- **Boot prints all three signals**: `[otel] metrics…`, `[otel] traces…`, `[otel] logs exporting to
  http://localhost:4317`.

- **Index labels are exactly four** (LOG-07), against real traffic, not probes:
  `service_name`, `service_namespace`, `service_instance_id`, `deployment_environment_name`.

- **The event count matches the traffic exactly.** The load test produced 50 `401 GET /v1/users/me`;
  `sum by (event_reason) (count_over_time({service_name="tatame-api"} | event_domain="access" [10m]))`
  returns `NO_SESSION 50`. Not "events appeared" — the right number of them.

- **Trace correlation is real in both directions** (LOG-08). An `access.denied` record carried
  `trace_id=573fa36b…`; `GET /api/traces/573fa36b…` returns the full request in Tempo, ending in
  the server span `GET /v1/users/me` with `http.response.status_code=401` and `error.type=401`.
  This is the check deferred from T3 and T4, now done against a real request rather than a probe.

- **The APM dashboard's log panels render** (deferred from T4). With the API running,
  `var-service_name` resolves to `tatame-api`, the whole dashboard reports **zero** "No data"
  panels, and the `Logs` row shows the stream with the upstream `line_format` applied:
  `WARN [ocal-35305] tatame-api access.denied [trace_id=1c4a9934…]`.

- **The API is unaffected when the stack is down** (LOG-10). With every observability container
  stopped, `/v1/health`, `/v1/ready` and the 401 path all answered correctly, no export error
  surfaced in the API's output, and logs kept going to stdout. Export is additive, as designed.

- **`OTEL_LOGS_ENABLED=false` isolates logs only.** Five 401s produced **0** records in Loki while
  Tempo kept receiving traces. This is the flag whose disabled branch was wrong until T7.

**One loose end, not diagnosed.** The upstream `Latest logs received` stat read "13 hours ago"
while the dashboard's range was `now-30m` and the log stream beside it showed current lines.
Running the panel's own query by hand returns a last data point ~0 minutes old, so the data is
right and the discrepancy is in the stat's reduce/format
(`reduceOptions.fields: "/^Time$/"`, `unit: dateTimeFromNow`). Not reproduced on a second look,
and left as-is: the traces spec found the sibling `Latest traces received` panel broken for a
different reason, so this panel pair is worth a look if it misreads again.

- **Two probe streams are now in Loki**, `service_name="probe"` and `"probe-eventname"`, from the
  T2 verification, plus one under `service_instance_id="t3-probe"` from T3. They age out with the 7-day retention; no cleanup was done.

## Success Criteria

- [ ] From a failed request in Tempo, its log lines are one click away — and back.
- [ ] `{service_name="tatame-api"} | event_domain="checkin" | event_outcome="rejected"` answers "why were check-ins refused
      this week", broken down by reason, without reading a single line of source.
- [ ] `grep -rn "console\." apps/api/src` returns only the three allowed files.
- [ ] Adding an event to an existing domain is one line in the catalog plus one call site.
- [ ] With the observability stack stopped, `pnpm api:dev` behaves exactly as it does today.
