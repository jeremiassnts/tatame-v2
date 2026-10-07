# Observability — metrics, traces and logs with OpenTelemetry

A local, free monitoring stack for the API: **OpenTelemetry SDK → OTel Collector →
Prometheus (metrics) + Tempo (traces) + Loki (logs) → Grafana**.

## The data path

```
apps/api (Node)                    push, OTLP/gRPC
  ├── @opentelemetry/sdk-node ──────────────────────► otel-collector :4317
  │     auto-instrumentations                              │
  │     (http, express, redis, node runtime)               ├── exposes /metrics
  │                                                        │        │
  └── telemetry/logger.ts ──┘                 otel-collector :8889 ◄─┴─ scrape ── prometheus :9090
        telemetry/events.ts                              │                              │
                                                         ├── push, OTLP/gRPC ──► tempo :4317
                                                         │                              │
                                                         └── push, OTLP/HTTP ─► loki :3100
                                                                                        │
                                                                    grafana :3300 ◄──────┘
```

The API only ever talks to the Collector, and all three signals ride the same
connection. Everything downstream is infrastructure config.

| Port | Who | What |
| --- | --- | --- |
| 4317 | otel-collector | OTLP **gRPC** — where the API pushes metrics, traces *and* logs |
| 4318 | otel-collector | OTLP HTTP — for manual pokes with curl |
| 8889 | otel-collector | Prometheus scrape endpoint (`/metrics`) |
| 9090 | prometheus | Query API + web UI |
| 3200 | tempo | Query API — `curl :3200/ready`, and where Grafana reads traces |
| 3100 | loki | Query API + OTLP ingest (`/otlp/v1/logs`) — where Grafana reads logs |
| 3300 | grafana | Dashboards (3000 on the host belongs to `next dev`) |

Tempo also listens on 4317 inside the compose network, but that port is deliberately
**not** published: on the host it belongs to the Collector. Loki is reached over
OTLP/**HTTP** rather than gRPC — see "The log path" below for why.

## Running it

```bash
# 1. start the stack (base compose + observability compose)
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d

# 2. tell the API where the Collector is (repo-root .env)
echo 'OTEL_COLLECTOR_URL=http://localhost:4317' >> .env

# 3. run the API as usual
pnpm api:dev

# 4. open Grafana → Dashboards → Tatame
open http://localhost:3300
```

Two dashboards are provisioned:

| Dashboard | What it is for |
| --- | --- |
| **Tatame API — Overview** (`/d/tatame-api-overview`) | Hand-written, this service only. Rates, errors, latency percentiles, slowest routes, Node runtime. |
| **Lightweight APM for OpenTelemetry** (`/d/otel-service-apm`) | The community APM dashboard, adapted (see below). Navigates namespace → service, so it keeps working when a second service starts reporting. Includes the trace list. |

Stop it with `docker compose -f docker-compose.yml -f docker-compose.observability.yml down`
(add `-v` to also wipe the Prometheus and Grafana volumes).

Without `OTEL_COLLECTOR_URL` the API logs `[otel] OTEL_COLLECTOR_URL not set — telemetry
disabled` and behaves exactly as before. Telemetry is always opt-in, and never runs
under `NODE_ENV=test`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `OTEL_COLLECTOR_URL` | unset (disabled) | `http://localhost:4317` from the host, `http://otel-collector:4317` from a container |
| `OTEL_METRIC_EXPORT_INTERVAL` | `10000` | How often metrics are pushed, in ms. Lower it for demos |
| `OTEL_SERVICE_NAME` | `tatame-api` | Becomes the `service_name` label |
| `OTEL_SERVICE_NAMESPACE` | `tatame` | Becomes the `service_namespace` label; groups every service of this product |
| `OTEL_TRACES_ENABLED` | `true` | Set to `false` to keep metrics but stop exporting spans |
| `OTEL_LOGS_ENABLED` | `true` | Set to `false` to stop exporting log records. stdout is unaffected |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error`. Also un-silences logging under `NODE_ENV=test` |

## Generating traffic

An empty dashboard proves nothing. `scripts/load-test.mjs` sends a weighted mix of
public endpoints so several routes and status codes show up at once:

```bash
pnpm load-test                                  # 20 req/s for 60s, 40 simulated clients
pnpm load-test -- --rps 50 --duration 120       # heavier
pnpm load-test -- --clients 1                   # watch the rate limiter trip
pnpm load-test -- --url http://localhost:3099   # a different port
```

| Route | Expected | Why it is in the mix |
| --- | --- | --- |
| `GET /v1/health` | 200 | The fast path — baseline latency |
| `GET /v1/version` | 200 | Another 200, so "by route" is not a single line |
| `GET /v1/users/me` | 401 | Auth rejection, exercises the Clerk middleware |
| `GET /v1/does-not-exist` | 404 | Unmatched route |
| `GET /v1/ready` | 200 | The slow one: `select 1` on Postgres plus a Redis ping. Low weight — do not hammer a shared database |

Each virtual client sends its own `X-Forwarded-For`. The API runs with
`trust proxy = 1`, so `express-rate-limit` buckets per forwarded IP: 40 clients
means 40 separate 100 req/min budgets. Without that, anything above ~1.6 req/s
would be 429s within a minute and the dashboard would show nothing but rejections.

Which is exactly what `--clients 1` gives you on purpose — all traffic in one
bucket, 429s climbing in the "by status code" panel. A good way to see a real
incident shape without breaking anything.

The script prints its own summary (status breakdown, p50/p95/p99). Comparing that
with the dashboard is a decent sanity check: the client-side p95 should sit just
above the server-side p95, the difference being network and client overhead.

## Verifying each hop

When a panel is empty, walk the path from the source — one curl per hop tells you
exactly where data stops.

```bash
# 1. is the API exporting?      → look for this line at boot
#    [otel] metrics exporting to http://localhost:4317 every 10000ms (service=tatame-api)

# 2. did the Collector receive it?
curl -s localhost:8889/metrics | grep http_server_request_duration_seconds_count

# 3. did Prometheus scrape it? (both targets must be "up")
curl -s localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job:.labels.job, health}'

# 4. what series exist at all?
curl -s localhost:9090/api/v1/label/__name__/values | jq

# 5. run a dashboard query by hand
curl -s --get localhost:9090/api/v1/query \
  --data-urlencode 'query=sum by (http_route) (rate(http_server_request_duration_seconds_count[1m]))' | jq
```

And the trace half of the path:

```bash
# 6. is Tempo up?
curl -s localhost:3200/ready

# 7. did any span arrive? (this is the APM dashboard's own query)
curl -s --get localhost:3200/api/search \
  --data-urlencode 'q={resource.service.name="tatame-api"}' --data-urlencode 'limit=5' | jq

# 8. what span names exist at all — a good check that Express is instrumented
curl -s localhost:3200/api/v2/search/tag/name/values | jq -r '.tagValues[].value' | sort
```

If step 7 is empty but step 2 has data, the Collector received the batch and failed to
forward it — `docker compose logs otel-collector | grep tempo` will say so.

And the log half:

```bash
# 9. is Loki up?
curl -s localhost:3100/ready

# 10. push one record straight through the Collector and read it back. This is the
#     whole path in two commands, and it needs no API running.
NS=$(python3 -c 'import time;print(int(time.time()*1e9))')
curl -s -X POST localhost:4318/v1/logs -H 'Content-Type: application/json' -d "{
  \"resourceLogs\":[{\"resource\":{\"attributes\":[
    {\"key\":\"service.name\",\"value\":{\"stringValue\":\"probe\"}}]},
  \"scopeLogs\":[{\"logRecords\":[{
    \"timeUnixNano\":\"$NS\",\"severityNumber\":9,\"severityText\":\"INFO\",
    \"body\":{\"stringValue\":\"hello\"}}]}]}]}"

curl -s --get localhost:3100/loki/api/v1/query_range \
  --data-urlencode 'query={service_name="probe"}' \
  --data-urlencode "start=$(( $(date +%s) - 300 ))000000000" | jq '.data.result'

# 11. which labels actually exist? (should be exactly the four resource attributes)
curl -s localhost:3100/loki/api/v1/labels | jq

# 12. did the API's own events arrive?
curl -s --get localhost:3100/loki/api/v1/query_range \
  --data-urlencode 'query={service_name="tatame-api"} | event_domain="checkin"' \
  --data-urlencode "start=$(( $(date +%s) - 3600 ))000000000" | jq '.data.result[].values'
```

If step 10 returns nothing, `docker compose logs otel-collector | grep -i loki` shows
whether the export failed. The usual cause is `allow_structured_metadata` being off:
Loki rejects the whole push, not just the metadata.

## What you get for free

No business code was changed. Everything below comes from `getNodeAutoInstrumentations()`:

| Series | From | Useful labels |
| --- | --- | --- |
| `http_server_request_duration_seconds_{bucket,count,sum}` | `instrumentation-http` | `http_route`, `http_request_method`, `http_response_status_code` |
| `http_client_request_duration_seconds_*` | `instrumentation-http` | outgoing HTTP calls |
| `nodejs_eventloop_delay_{p50,p90,p99,...}_seconds`, `nodejs_eventloop_utilization_ratio` | `instrumentation-runtime-node` | — |
| `v8js_memory_heap_used_bytes`, `v8js_gc_duration_seconds_*` | `instrumentation-runtime-node` | `v8js_heap_space_name`, `v8js_gc_type` |

Every series also carries `service_name`, `service_namespace`, `service_instance_id`
and `deployment_environment_name`, copied from the SDK's resource attributes by the
Collector (`resource_constant_labels` in the Collector config).

Spans come from the same instrumentations, no extra configuration:

| Span | From |
| --- | --- |
| `GET /v1/health` and friends — the request root span | `instrumentation-http` |
| `middleware - helmetMiddleware`, `router - /version`, `request handler - /v1/ready` | `instrumentation-express` |
| `redis-PING`, `redis-EVALSHA`, `redis-connect` | `instrumentation-redis` |
| `tcp.connect` | `instrumentation-net` |

### Investigating a failed request

Out of the box a failed request leaves only a status code on the span — you learn it
was a 401, never why. Two attributes and one event close that gap:

| On the span | What it is |
| --- | --- |
| `error.type` | The application error code when the envelope carries one (`CHECKIN_WINDOW_CLOSED`), otherwise the status code as a string |
| `app.error.body` | The error response body the API actually sent, redacted and truncated to 2 KB |
| `exception` event | Type, message and **stack trace** — only for errors that reached `errorHandler`, i.e. real 5xx failures |

```
SPAN 'GET /v1/users/me'          status = unset
  http.response.status_code = 401
  error.type                = 401
  app.error.body            = {"error":"Unauthorized"}

SPAN 'POST /v1/checkin'          status = ERROR
  http.response.status_code = 500
  error.type                = 500
  app.error.body            = {"error":"Expected property name or '}' ..."}
  EVENT exception
    exception.type       = SyntaxError
    exception.stacktrace = SyntaxError: ... at JSON.parse (<anonymous>) ...
```

Useful TraceQL:

```
{span.error.type != nil}                       # every failed request
{status = error}                               # only real server failures (5xx)
{span.error.type = "CHECKIN_WINDOW_CLOSED"}    # one business error
{span.http.response.status_code >= 400}        # by status
```

Span **status** is deliberately left as the instrumentation sets it: 5xx is `ERROR`,
4xx is `unset`. That is what the HTTP semantic conventions ask for on a server span —
a 4xx is the caller's fault — and it keeps `{status = error}` meaning "my service
broke" instead of drowning in expired-token 401s. Use `error.type` to find 4xx.

**How it works.** `apps/api/src/telemetry/error-capture.ts` wraps `res.json` and
stashes the body on the response when the status is >= 400;
`applyCustomAttributesOnSpan` in `instrumentation.ts` reads it and writes the
attributes onto the server span.

Two things worth knowing if you go editing it:

- Enriching `errorHandler` alone would have covered almost nothing. Most error
  responses never reach it — `requireSession` writes its own 401, `validateBody` its
  own 400, `express-rate-limit` its own 429. Wrapping `res.json` catches all of them.
- The hook is `applyCustomAttributesOnSpan`, **not** `responseHook`. Despite the name,
  `responseHook` only fires on the outgoing/client path; the incoming path calls
  `applyCustomAttributesOnSpan` from `_onServerResponseFinish`.

**What is not captured**: request bodies, ever. Successful responses. And Express'
built-in 404, which finalhandler writes as HTML without going through `res.json` — for
those the status code and `http.route` already tell the whole story.

**Redaction** replaces values whose key looks sensitive. Long unambiguous words
(`password`, `secret`, `token`, `authorization`, `cookie`, `credential`, `signature`)
match anywhere in the key; short ones (`key`, `auth`, `pin`, `otp`, `salt`, `hash`)
match only whole name segments, so `apiKey` is redacted and `monkey` is not. One
residual to keep in mind: a 400 from `validateBody` carries `parsed.error.flatten()`,
and a few Zod messages echo the value they rejected.

### Postgres is not traced

`packages/db` uses **`postgres`** (postgres.js), and `@opentelemetry/instrumentation-pg`
patches the **`pg`** package. Different library, so it never activates: there are no
Postgres spans and no `db_client_operation_duration_seconds` series. The
`Outbound Databases` table on the APM dashboard stays empty because of this, not
because the panel is misconfigured.

The visible effect: a slow `/v1/ready` shows up as a slow request with a gap in the
middle of its trace — you can see that time went somewhere, but not into which query.
Closing it means either a postgres.js instrumentation or wrapping the query path by
hand. Redis, by contrast, is fully traced.

Durations are in **seconds** (stable HTTP semantic conventions). Tutorials and older
community dashboards query `http_server_duration_milliseconds_bucket` — that name no
longer exists in `@opentelemetry/instrumentation-http` ≥ 0.222.0 and is the usual
reason an imported dashboard shows "No data".

## The ESM loader hook

`apps/api/otel-esm-hook.mjs` is loaded via `node --import` in the `dev` and `start`
scripts. It exists because this is an ESM app: `import express from "express"` does
not go through the CommonJS require hook the instrumentations patch, so Express was
never instrumented and every HTTP metric came back **without `http_route`**. The hook
registers `import-in-the-middle` to patch ESM imports too.

It is deliberately scoped to `express`. Hooking everything makes the loader rewrite
the app's own modules and drizzle-orm's re-export barrels, which crashes at boot with
`SyntaxError: The requested module 'drizzle-orm' contains conflicting star exports`.
When you add an instrumentation for another ESM-imported library, add that package
name to the `include` list.

The hook registers unconditionally. It used to be guarded on `OTEL_COLLECTOR_URL`,
which was wrong: `--import` runs before `env-bootstrap.js` loads the root `.env`, so
the variable is still empty at that point whenever it is configured the documented
way — and the guard silently cost every request its `http_route` label while
everything else looked healthy. Registering always is cheap (it wraps one module at
startup); `instrumentation.ts` still decides whether any telemetry is produced.

If `http_route` disappears from your series, this hook is the first thing to check:

```bash
curl -s localhost:8889/metrics | grep -o 'http_route="[^"]*"' | sort -u
```

## Files

| Path | Purpose |
| --- | --- |
| `apps/api/src/instrumentation.ts` | Starts the SDK; imported first in `server.ts` |
| `apps/api/src/telemetry/logger.ts` | The one way anything writes a log |
| `apps/api/src/telemetry/events.ts` | The typed domain-event catalog |
| `apps/api/src/telemetry/redact.ts` | Shared redaction — import-free on purpose |
| `apps/api/src/telemetry/error-capture.ts` | Puts error response bodies on the server span |
| `apps/api/tsconfig.test.json` | Typechecks test files, which `tsconfig.json` excludes |
| `apps/api/otel-esm-hook.mjs` | ESM loader hook (see above) |
| `scripts/load-test.mjs` | Traffic generator (`pnpm load-test`) |
| `scripts/build-apm-dashboard.mjs` | Adapts the upstream APM dashboard to this stack |
| `docker-compose.observability.yml` | Dev stack: Collector + Prometheus + Tempo + Loki + Grafana |
| `docker-compose.observability.prod.yml` | The same five, deployable: no published ports, Grafana behind a login |
| `infra/observability/otel-collector-config.yml` | Receivers, processors, exporters |
| `infra/observability/prometheus.yml` | Scrape targets and `target_info` relabeling |
| `infra/observability/tempo.yml` | Tempo, monolithic mode, traces on local disk |
| `infra/observability/loki.yml` | Loki, single-binary mode, logs on local disk |
| `infra/observability/upstream/` | Vendored third-party dashboards, never edited |
| `infra/observability/grafana/provisioning/` | Datasource + dashboard provider |
| `infra/observability/grafana/provisioning/alerting/` | Contact point, notification policy and alert rules |
| `infra/observability/grafana/dashboards/` | Dashboard JSON (edit on disk, Grafana reloads in ~10s) |

## Traces

Sampling is the SDK default, `parentbased_always_on` — every request is recorded. That
is right for a dev stack and wrong for anything with real traffic; when that day comes,
set `OTEL_TRACES_SAMPLER=parentbased_traceidratio` and `OTEL_TRACES_SAMPLER_ARG=0.1`.
The SDK reads both natively, so it needs no code change.

Traces are retained for 7 days (`backend_worker.compaction.block_retention` in
`infra/observability/tempo.yml`), matching Prometheus and Loki.

## The log path

Logs go the same way as everything else — SDK to Collector — but they need one thing
metrics and traces do not: something in the application has to *call* the logger.

```
apps/api code ──► telemetry/logger.ts ──┬──► stdout, always
                  telemetry/events.ts   │
                                        └──► @opentelemetry/api-logs
                                                    │
                                       BatchLogRecordProcessor (NodeSDK)
                                                    │
                                        otel-collector :4317 ──► loki :3100/otlp
```

**stdout is unconditional.** Export is additive: with the stack down, `pnpm api:dev`
prints exactly what it always did. `OTEL_LOGS_ENABLED=false` stops the export and
leaves the terminal alone.

**`logger.ts` never imports the SDK.** It asks `@opentelemetry/api-logs` for the
global provider, which `instrumentation.ts` may or may not have registered; when
telemetry is off, that call returns a no-op. This is what makes `logger.ts` an
ordinary module any file can import, with none of the load-order constraints
`error-capture.ts` lives under — and it is what makes `trace_id` correlation work,
because emission happens on the main thread, inside the active span.

> The previous observability stack logged through pino with
> `pino-opentelemetry-transport`. Pino transports run in a **worker thread**, which
> cannot see the main thread's span context, so the transport stood up a second
> `LoggerProvider` with its own resource attributes. That is why `62b4051`'s commit
> message says logs went out "through two competing paths" and why the Loki derived
> field "matched a trace_id pattern OTLP logs never emit". Both are the same bug.

### Why `otlp_http/loki` and not a `loki` exporter

There is no `loki` exporter. `otel/opentelemetry-collector-contrib:0.160.0` ships
`loki` only as a *receiver* — check for yourself:

```bash
docker run --rm --entrypoint /otelcol-contrib \
  otel/opentelemetry-collector-contrib:0.160.0 components | grep -A1 'name: loki'
```

Logs go to Loki's native OTLP endpoint instead, via `otlp_http/loki` pointed at
`http://loki:3100/otlp`. Note the component is named `otlp_http` in this
distribution, not `otlphttp`. Loki also requires `allow_structured_metadata: true`
to accept OTLP at all.

### Labels vs. structured metadata

Loki indexes only **resource** attributes, and only the ones on its default list.
For this service that is exactly four:

```bash
curl -s localhost:3100/loki/api/v1/labels | jq
# service_name, service_namespace, service_instance_id, deployment_environment_name
```

Everything else — `event_domain`, `event_outcome`, `event_reason`, `user_id`,
`trace_id`, `exception_type` — is **structured metadata**, filtered with `|` rather
than matched inside `{}`:

```logql
{service_name="tatame-api"} | event_domain="checkin" | event_outcome="rejected"
```

This is deliberate. A label multiplies the stream count by its cardinality; Loki 3.x
filters structured metadata efficiently and caps index labels at 15 for good reason.

One trap when reading query output by hand: `query_range` merges labels and
structured metadata into a single `stream` object per result, so it *looks* like
everything became a label. `/loki/api/v1/labels` is the honest answer.

## The event catalog

Logs answer "what did the code say". Events answer "what did the business do", and
they are the reason this iteration exists. A refused check-in used to be a 409 with
Portuguese prose; now it is `checkin.rejected` with `WEEKLY_LIMIT_REACHED`, and the
difference is whether "why were check-ins refused this week?" is a query or an
afternoon of reading source.

`apps/api/src/telemetry/events.ts` holds the whole catalog. Eight domains:

| Domain | What it covers |
| --- | --- |
| `checkin` | Created, and ten distinct refusal reasons |
| `membership` | Requested, approved, rejected, blocked, unblocked, left |
| `subscription` | Student plans: created, updated, assigned |
| `payment` | Created, checkout started, confirmed, transferred |
| `manager_subscription` | The Pro plan via Stripe, including unhandled webhooks |
| `graduation` | Initial belt, promotion, and invalid-progression refusals |
| `access` | Who was turned away and why — no session, role, plan, rate limit |
| `request` | Unhandled 5xx. The failures that are ours |

Every record carries `event.name`, `event.domain`, `event.outcome`
(`success` / `rejected` / `failed`) and, on a refusal, `event.reason`. Outcome maps to
severity: success is `INFO`, rejected is `WARN`, failed is `ERROR`.

### Questions it answers

```logql
# Why were check-ins refused this week, ranked?
sum by (event_reason) (
  count_over_time({service_name="tatame-api"} | event_domain="checkin" | event_outcome="rejected" [1w])
)

# Everything that happened to one student
{service_name="tatame-api"} | user_id="usr_..."

# The failures that are ours, with stacks
{service_name="tatame-api"} | event_name="request.failed"

# Stripe webhooks we received and did nothing with
{service_name="tatame-api"} | event_name="manager_subscription.webhook_unhandled"

# Everything written while one trace was open
{service_name="tatame-api"} | trace_id="<id>"
```

### Adding an event

One entry in the catalog, one call site.

```typescript
// 1. src/telemetry/events.ts
"announcement.published": { domain: "announcement", outcome: "success" },

// 2. the call site
emitEvent("announcement.published", { userId, academyId, announcementId: row.id });
```

`emitEvent` is typed against the catalog: an unlisted name does not compile, `reason`
is **required** on events that declare reasons and **forbidden** on those that do not,
and only that event's own reasons are accepted. Four `@ts-expect-error` assertions in
`events.test.ts` pin each rule.

Two things that gate this, both learned the hard way:

- `tsconfig.json` excludes `*.test.ts`, so `tsc --noEmit` never sees a test file — and
  an unchecked `@ts-expect-error` asserts nothing. `tsconfig.test.json` exists for
  this, and `pnpm typecheck` runs both.
- `catalog-coverage.test.ts` scans the source for every event name and reason and
  fails when one is declared but never emitted. An event that cannot fire reads as
  coverage and never lights up.

### What is deliberately not an event

Background workers (email, push, engagement) write structured logs and reach Loki like
everything else, but they do not define event names — this iteration scoped the
catalog to the request path.

`payment.failed` and `access.denied`/`FEATURE_LOCKED` were specified and then removed:
both payment webhook handlers return early on any non-success event, and
`requirePlanFeature` calls `next()` unconditionally. Neither could ever fire.

Retention is **7 days**, matching Prometheus and Tempo. Loki is not an audit trail —
if you need "who promoted this student in March", that is a table in Postgres.

## Logging, without an event

For everything that is not a domain action:

```typescript
import { log } from "../telemetry/logger.js";

log.info("worker started", { component: "email" });
log.warn("no queue available, skipping push delivery", { component: "notification" });
log.error("job failed", { component: "email", jobName, jobId, err });
```

`err` is expanded into `exception.type`, `exception.message` and
`exception.stacktrace` — pass the error itself, not `err.message`. Field values whose
key looks sensitive are redacted by `telemetry/redact.ts`, the same list the span
error capture uses.

`console.*` is a lint error under `apps/api/src`. Three exceptions, each for a reason:
`*.test.ts`, `seed.ts` (a CLI whose output is the product) and `instrumentation.ts`
(it runs before the logger exists, and importing it would recreate the load-order
hazard the telemetry module is arranged to avoid).

## The APM dashboard

`Lightweight APM for OpenTelemetry` is [grafana.com dashboard 22784][22784] revision 7,
by Cyrille Le Clerc. The upstream JSON is vendored unchanged at
`infra/observability/upstream/22784_rev7.json`; `scripts/build-apm-dashboard.mjs`
transforms it into the provisioned
`infra/observability/grafana/dashboards/otel-service-apm.json`.

```bash
node scripts/build-apm-dashboard.mjs           # rebuild
node scripts/build-apm-dashboard.mjs --check   # fail if the output is stale
```

Keeping it as a script rather than a hand-edit means a new upstream revision is a drop-in
plus a re-run. Grafana is provisioned with `allowUiUpdates: true`, so if you tweak the
dashboard in the UI, fold the change back into the script — the next rebuild overwrites
anything else.

What the script changes, and why:

| Change | Why |
| --- | --- |
| Strips `__inputs` / `__requires` / `__elements`, rewrites `${DS_GRAFANACLOUD-*}` to the dashboard's own datasource variables | That scaffolding exists for manual import through grafana.com. Provisioning never runs an import, and Grafana errors on unresolved `${DS_*}` |
| JVM row → Node runtime (event loop delay, V8 heap, GC time) | This is a Node service |
| Deletes the three gRPC panels | No gRPC server or client in this project |
| Moves the two Loki panels into the `Logs` row | Upstream puts `Latest logs received` in the header band, which is already full; it reads better beside the log stream it counts |
| Deletes the setup-instructions panel | It says to delete it after setup, and it documents ingesting through Prometheus' native OTLP endpoint — not how this stack is wired |
| `Outbound Databases` error column: `http_response_status_code=~"5.."` → `error_type!=""` | Upstream copy-pasted the HTTP selector onto a database metric that has no such label, making the column a constant zero |

### Why `target_info` needed relabeling

The dashboard's service picker is built on `label_values(target_info, service_name)`,
and `target_info` is the one series that arrives *without* `service_name`. The
Collector's Prometheus exporter follows the OTLP-to-Prometheus spec and collapses
`service.namespace` + `service.name` into `job` there; Prometheus renames it to
`exported_job` on scrape, because its own scrape labels already own `job`.

`metric_relabel_configs` in `infra/observability/prometheus.yml` splits
`exported_job="tatame/tatame-api"` back into the two labels. It is scoped to
`target_info` — every other series already carries them as constant labels.

`target_info` is the right basis for the picker precisely because it exists whether or
not the service is serving traffic; a picker built on request metrics goes blank the
moment the service is idle.

[22784]: https://grafana.com/grafana/dashboards/22784

## Alerting

Dashboards answer questions you thought to ask. Alerting is the part that tells you
to ask one. Everything below is provisioned from
`infra/observability/grafana/provisioning/alerting/` — three files, mounted the same
way `datasources/` and `dashboards/` already are:

| File | What it holds |
| --- | --- |
| `contact-points.yml` | One contact point, `tatame-email`, address from `$ALERT_EMAIL_TO` |
| `notification-policies.yml` | The routing tree: grouping, and how often a still-firing alert repeats |
| `rules.yml` | The nine rules, their thresholds and their `for` durations |

Provisioned alert rules are **read-only in the Grafana UI**. Grafana shows them with
a "Provisioned" badge and no edit button, which is the point: a threshold is a commit,
reviewable and reproducible, and it survives the volume being rebuilt.

### The rules

All nine live in the `Tatame Alerts` folder, in one group evaluated every minute.

| Rule | Fires when | `for` | Severity |
| --- | --- | --- | --- |
| API not reporting | `target_info` for `tatame-api` is missing from Prometheus | 3m | critical |
| API returning 5xx | more than 5 responses with a 5xx status in 5 minutes | 2m | critical |
| API 5xx ratio above 20% | over 20% of requests are 5xx, with at least 0.05 req/s of traffic | 5m | critical |
| Student payment received and not recorded | **any** `payment.webhook_unhandled` with `NO_PENDING_PIX` or `MISSING_REFERENCE` in 15 minutes | 5m | critical |
| Payment recorded but its emails were skipped | more than 3 with `USER_OR_ACADEMY_NOT_FOUND` or `OWNER_NOT_FOUND` in 30 minutes | 5m | warning |
| Pro subscription payments failing | more than 3 `manager_subscription.past_due` in 15 minutes | 5m | warning |
| Stripe webhooks received and ignored | more than 3 `webhook_unhandled` in 30 minutes, excluding `UNKNOWN_EVENT_TYPE` | 5m | warning |
| Observability component down | a Prometheus target has `up < 1` | 5m | critical |
| Collector failing to export telemetry | `otelcol_exporter_send_failed_*` is increasing | 10m | critical |

Each rule is the same two stages — `A` asks the datasource for one number *right
now*, `B` compares it to the threshold — which is the shape
`GET /api/v1/provisioning/alert-rules/export` produces, so an exported rule diffs
cleanly against the file.

Every `A` is an **instant** query, and there is deliberately no `reduce` stage. The
first draft of these rules used the other common shape — a range query reduced with
`last` — and it is quietly broken. `reduce` with `mode: dropNN` skips the empty tail
of a series and returns the last value that *existed*, so a condition that stopped
being true ten minutes ago still reads as true until it scrolls out of the query
window. For `absent()` it is not a delay but an inversion: the healthy state produces
no points at all, which is exactly the tail `dropNN` skips.

Measured while building this, with the API healthy again and `absent()` returning
empty on an instant query, the 10-minute range query still returned `1` from nine
minutes earlier and the alert stayed firing. The smoothing belongs in the PromQL /
LogQL window and in `for`, not in the reduce.

### Why 5xx is a metric and not an event

The obvious rule to write is "alert when `request.failed` appears", and it is the
wrong one. `apps/api/src/middleware/error-handler.ts` returns early for `HttpError`:

```ts
if (err instanceof HttpError) {
  res.status(err.statusCode).json({ ... });
  return;                       // <- emitEvent("request.failed") is below this
}
```

So the 502 that `payment.service.ts` raises when AbacatePay is unreachable is a
server error the caller sees and the event catalog never records. Alerting on the
event would miss exactly the class of failure worth waking up for.

`http_server_request_duration_seconds_count{http_response_status_code=~"5.."}` has no
such blind spot — it counts the response, not the code path that produced it. The
event is still the better *debugging* tool, and the alert's description says so: it
carries the LogQL to run next.

### The payment rules

The task this came from proposed alerting on `payment.*` with
`event_outcome="failed"`. At the time no such event existed: every `payment.*` entry in
the catalog was an `outcome: success`, because both webhook handlers processed only the
success event and `return`ed on anything else. There was no failure path in the code to
report from.

TAT-104 changed that. The Asaas rails added two events that are not successes, and both
have rules:

| Event | Outcome | Means |
| --- | --- | --- |
| `payment.charge_failed` | `failed` | A student tried to pay and Asaas refused to open the charge, or to show its QR code |
| `payment.reversed` | `rejected` | A refund or a chargeback — and because the split already paid the academy, the money comes out of *their* wallet |

Both are deliberately one broad signal with the Asaas code and sentence in `extra`,
rather than a reason per cause: the causes are Asaas's to invent, and an enumeration
here would always be one release behind the one that actually fires.

What is still not done is telling a student their Pix expired. That needs the provider
failure event types to be *handled* first (`payment_intent.payment_failed`,
`checkout.session.expired` and the Asaas equivalents), which is a product decision
before it is an observability one.

What was wrong with the original framing is that it looked in the wrong place. The
dangerous gap was not the failure path; it was the **success** path. Both handlers had
a chain of silent `return`s, and two of them mean money moved and nothing was
recorded:

| Drop | Reason | What it costs |
| --- | --- | --- |
| An Asaas charge matching no pending row | `NO_PENDING_CHARGE` | Paid, no payment row, student still overdue |
| `billing.paid` whose `pixQrCodeId` matches no pending row | `NO_PENDING_PIX` | Same, on the retired AbacatePay rail |
| `checkout.session.completed` with no metadata | `MISSING_REFERENCE` | Same, via Stripe |
| The month already had a payment row | `DUPLICATE_MONTH` | Nothing lost — but the student paid twice and someone must decide about a refund |
| The delivery's Asaas account is not ours | `FOREIGN_ACCOUNT` | Two environments sharing a webhook url or token; the *sender* recorded nothing |
| student or academy cannot be loaded | `USER_OR_ACADEMY_NOT_FOUND` | Payment recorded, confirmation email lost |
| academy owner cannot be loaded | `OWNER_NOT_FOUND` | Payment recorded, manager email lost |
| Provider event type we do not handle | `UNKNOWN_EVENT_TYPE` | Nothing — normal traffic, the one reason deliberately left unalerted |

None of these produced any signal at all: the route answers `{received: true}` with
200 and the provider considers the webhook delivered. `manager_subscription` already
reported its equivalent through `manager_subscription.webhook_unhandled`; these two
handlers had simply been left out. They now emit `payment.webhook_unhandled`, and the
three reasons that mean a payment was lost share the one **critical** rule with a
**threshold of zero** — one lost payment is already worth an email. `DUPLICATE_MONTH`
and `FOREIGN_ACCOUNT` have their own zero-threshold rules at `warning`, because each
occurrence needs a person without anybody being woken up.

`NO_PENDING_CHARGE` is the reason to keep in mind when reading these rules. It is the
Asaas spelling of `NO_PENDING_PIX`, and for one release the rule matched only the two
legacy reasons — so after the cutover the reason a lost payment *actually* reports had
no rule at all. `catalog-coverage.test.ts` now fails if any money reason is missing
from the `expr:` lines in `rules.yml`, which is the check that would have caught it.

One asymmetry worth knowing: the AbacatePay handler reports `UNKNOWN_EVENT_TYPE` and
the Stripe one does not. `/webhooks/stripe` runs `StripeCheckoutWebhookHandler` and
then `StripeSubscriptionWebhookHandler` on the same event, and the second already
reports unknown types from its default branch. Reporting in both would double-count
every Stripe event the account sends.

The two shapes of failure are complementary, which is why both sets of rules exist.
The HTTP rules catch anything that *breaks* while taking a payment, including the 502
`payment.service.ts` raises when AbacatePay refuses to create a QR code. The
`payment.webhook_unhandled` rules catch the opposite: nothing broke, no error was
raised, and the work silently did not happen.

### How an ongoing problem stays one email

Three numbers in `notification-policies.yml` do this:

| | Meaning | critical | warning |
| --- | --- | --- | --- |
| `group_wait` | hold the first notification, so alerts firing together arrive together | 30s | 5m |
| `group_interval` | minimum gap between emails for a group that *changed* | 5m | 30m |
| `repeat_interval` | how often to re-send a group that has not changed at all | 4h | 24h |

Groups are keyed on `alertname`, `grafana_folder`, `service_name` and `job`. An outage
that starts at 03:00 and is still going at 09:00 is two emails on the critical route,
not three hundred. When it ends, `disableResolveMessage: false` on the contact point
sends the resolved notification — an alert that never tells you it stopped is worse
than no alert, because you cannot tell an ongoing outage from one that ended.

### Silencing one

Silences are runtime state, not configuration, so this is the one part of alerting you
do click: **Alerting → Silences → Add silence**, match on `alertname` (and
`job`/`service_name` to narrow it), set an end time. It survives restarts — it lives in
the `tatame_grafana_data` volume, not in the repo.

Silence for a deploy window; change the threshold in `rules.yml` for anything that
needs silencing twice.

### One trap when editing these files

Grafana interpolates `$VAR` from the environment when it reads a provisioning file,
and its docs say a literal dollar must be doubled as `$$`. That is true of
**contact-point settings** — it is how `$ALERT_EMAIL_TO` works — and *not* true of
**alert-rule annotations**, which are read as a plain string map with no expansion
step. So an annotation must be written `{{ $labels.job }}`, plain. Written `$$labels`
it is stored verbatim and the rule fails to expand its own template:

```
level=error msg="Error in expanding template" error="... bad character U+0024 '$'"
```

The alert still fires; the email just arrives with no labels in it. Following the
documented escaping broke six of the seven rules here before it was caught, so grep
the Grafana log for `Error in expanding template` after any annotation edit.

### Changing a threshold

Edit `rules.yml` and restart Grafana, or hot-reload without one:

```bash
# from anywhere with the admin password
curl -X POST -u admin:<password> https://<grafana-domain>/api/admin/provisioning/alerting/reload
```

Keep `uid` stable across edits. Changing it makes Grafana delete the old rule and
create a new one, which drops its state — a firing alert re-fires from scratch and any
silence attached to it stops matching.

### Verifying it end to end

Three things can be true independently: the rules evaluate, SMTP works, and an email
arrives. Check them in that order.

```bash
# 1. did the files provision at all? (a syntax error here is fatal at startup —
#    Grafana refuses to boot rather than run with half a config)
docker logs <grafana> 2>&1 | grep -i "provisioning\|alerting"

# 2. are the rules there and evaluating? Alerting -> Alert rules should list
#    nine under "Tatame Alerts", each with a state, none in Error.
```

Then a **test send**: Alerting → Contact points → `tatame-email` → **Test**. This is
the only step that proves SMTP. Grafana does not validate the contact point at startup,
so a wrong password or an unverified sender domain looks exactly like a working setup
until something fires.

Last, prove a rule actually fires *and* resolves. The cheapest one to trigger without
breaking anything real:

```bash
# stop Loki. "Observability component down" fires ~5 minutes later.
docker stop <loki>
# ... wait for the email, then
docker start <loki>
# ... and wait for the [RESOLVED] one.
```

Do this once, after the first deploy. If the firing email arrives and the resolved one
does not, the problem is `disableResolveMessage`, not the rule.

### What the stack watches about itself

`up` only exists for targets Prometheus was told to scrape, so
`infra/observability/prometheus.yml` scrapes all of them: the Collector's data
endpoint (`:8889`), its *internal* endpoint (`:8888`), Loki, Tempo, Grafana and
Prometheus itself. The three stores contribute no series to any dashboard — they are
scraped so that "Observability component down" has something to be false about.

Two details that are easy to get wrong:

- The Collector binds its internal metrics to `localhost` by default (since v0.113),
  which inside a container means the endpoint exists and nothing can reach it. The
  `service.telemetry.metrics.readers` block in `otel-collector-config.yml` opens it to
  `0.0.0.0`. Without it the `otel-collector-internal` target is permanently down and
  "Collector failing to export telemetry" can never fire.
- Grafana being the down component is the one case this cannot report. The email would
  have to come from the thing that is down.

### Detecting an API that is simply gone

Nothing scrapes the API — it pushes — so there is no `up` series for it and no
`up == 0` to alert on. What replaces it is the Collector's Prometheus exporter
forgetting series it has stopped receiving. `metric_expiration: 2m` in
`otel-collector-config.yml` sets that, down from the 5m default, and the rule's 3m
`for` makes the total detection window about six minutes.

Shortening it is safe because the SDK re-exports every series on each interval (30s in
production) whether or not anything changed — two minutes is four missed exports, not
a quiet period. Raising it again slows the alert, not just the dashboards.

Measured locally, stopping the telemetry at 13:17:16: the rule went pending at
13:20:17, fired at 13:23:17 and the email landed at 13:23:58. Call it six and a half
minutes from "the API died" to "there is an email", and roughly ninety seconds the
other way once it comes back.

## No auth, locally

Grafana runs with anonymous admin access and no login form. That is fine for
`localhost`, and it is the single biggest reason `docker-compose.observability.yml`
must never be the file you deploy. The production stack is a separate compose file;
see below.

Worth being precise about *why* it is a separate file rather than a hardened version
of this one. Grafana is the only service here that has authentication to switch on.
Prometheus, Tempo and the Collector ship none at all, and Loki's `auth_enabled: false`
is its single-tenant mode — not a setting someone left off. For those four, "not
reachable" is the only access control that exists.

## Deploying to Coolify

`docker-compose.observability.prod.yml` is the file to deploy. It mounts the same
configs from `infra/observability/` — the production differences are all in the
compose file itself, so there is nothing to keep in sync.

| | Dev (`docker-compose.observability.yml`) | Prod (`docker-compose.observability.prod.yml`) |
| --- | --- | --- |
| Published ports | 7 | none |
| Grafana | anonymous admin, no login form | login form, generated password, no sign-up |
| Prometheus retention | 7d | 7d **and** 2GB, whichever comes first |
| Healthchecks | none | Prometheus and Grafana (see below) |
| Reachable from the internet | — | Grafana only, through Coolify's proxy |

### The shape: two resources

The API is already its own Coolify resource. The observability stack is a second one,
and they talk over Coolify's predefined network:

```
Coolify resource "tatame-api"          Coolify resource "tatame-observability"
  (Dockerfile build pack)                (Docker Compose build pack)

  api ──── OTLP/gRPC ───────────────►  otel-collector ──► prometheus
           otel-collector-<uuid>:4317        │             tempo
                                             └──────────►  loki       ──► grafana ──► :443
                    predefined network `coolify`                              (the only domain)
```

Keeping them separate is what lets you redeploy the API without restarting Grafana,
and vice versa. The cost is one manual step: the Collector's hostname carries the
stack's uuid, which only exists after the first deploy.

### Steps

**1. Create the resource.** The source and the build pack are two separate choices in
Coolify, and both matter here:

| Screen | Choose |
| --- | --- |
| + New Resource | **Private Repository (with GitHub App)** — the same source the API uses |
| Repository | this repository, branch `main` |
| Build Pack | **Docker Compose** |
| Docker Compose Location | `/docker-compose.observability.prod.yml` |

Do **not** use "Docker Compose Empty" and paste the file contents — see the next step
for why.

**2. Tick "Preserve Repository During Deployment"** (Configuration → General, under
Build). Nothing works without it, and the way it fails is worth understanding once.

Every service here mounts its config with a relative bind mount
(`./infra/observability/...`), which Coolify resolves against
`/data/coolify/applications/<uuid>/` on the server. By default a compose deployment
keeps only the compose file there and discards the rest of the clone — so those four
paths do not exist. Docker's response to a missing bind-mount source is to silently
**create an empty directory**, and from there the five containers fail in two
different ways:

- **otel-collector** fails to start at all: `/etc/otelcol-contrib/config.yaml` already
  exists as a file inside the image, and a directory cannot be mounted over a file.
  This is the error the deploy log shows, and it is the useful one —
  `not a directory: Are you trying to mount a directory onto a file (or vice-versa)?`
- **tempo** and **loki** start and then crash-loop. `/etc/tempo.yml` and `/etc/loki.yml`
  do not exist in their images, so the empty directory mounts cleanly and each process
  discovers only at startup that its config file is a folder.

One cause, two symptoms. If a redeploy still fails after ticking the box, clear the
directories Docker left behind first — Coolify will not overwrite a directory with a
file:

```bash
rm -rf /data/coolify/applications/<uuid>
```

**3. Enable "Connect To Predefined Network"** — Configuration → **Advanced** in the
resource's left menu. (Coolify's own docs call this the "Service Stack page", which is
the page name for one-click Services; this resource is an Application with the Docker
Compose build pack, and for those it lives under Advanced.) Without it the stack gets a
private network of its own and the API cannot resolve any of it. Application resources
like the API are already on that network, so nothing changes on the API side.

**4. Give Grafana a domain**, and only Grafana. Configuration → General lists a
*Domains for …* field per service, one for each of the five. Fill in Grafana's and
leave the other four **empty** — they have no ports and no route, which is exactly what
protects them.

Make the URL `https://`. Coolify's "Generate Domain" produces an `http://…sslip.io`
address, and Grafana is configured with `GF_SECURITY_COOKIE_SECURE=true`: over plain
HTTP the browser discards the session cookie and the login form silently bounces back
to itself. Serving the admin login over HTTP would also put the password on the wire in
the clear. Editing the scheme to `https://` is enough — the proxy issues the
certificate, sslip.io addresses included.

**5. Read the generated Grafana password** from the resource's Environment tab
(`SERVICE_PASSWORD_GRAFANA`). Coolify generates it once and keeps it across deploys.
The user is `admin`.

Grafana applies that password when it *creates* the admin user — that is, on the
first boot against an empty `tatame_grafana_data` volume. Changing it afterwards is a
password change inside Grafana, not an edit to the environment.

**6. Set the alerting variables**, on the observability resource's Environment tab:

```
ALERT_EMAIL_TO=ops@tatame.app
GRAFANA_SMTP_PASSWORD=re_...
GRAFANA_SMTP_FROM_ADDRESS=alertas@tatame.app
```

Only these three. The rest (`GRAFANA_SMTP_ENABLED`, `_HOST`, `_USER`, `_FROM_NAME`)
default to Resend in the compose file and need setting only to move off it. The
password is a Resend API key and can be one scoped to sending, separate from the API's
own `RESEND_API_KEY`; the sender must be on a domain verified in Resend.

`ALERT_EMAIL_TO` is read by Grafana's *provisioning*, not by Docker —
`contact-points.yml` contains the literal `$ALERT_EMAIL_TO`. Several recipients are
separated by `;`, not by commas. Its default is `alertas@example.invalid`, an address
that cannot receive mail, so a deploy that forgets this fails loudly at the test send
rather than silently at 03:00.

Then do the **test send** and the fire/resolve check from "Verifying it end to end"
above. Nothing before this point proves an email can leave the server.

**7. Point the API at the Collector.** Coolify suffixes compose container names with
the stack's uuid, so read the real name off the server rather than guessing it:

```bash
docker ps --format '{{.Names}}' | grep otel-collector
# otel-collector-h4s8ckw0og0sc0scg4c4wsg0
```

Then set, on the **API** resource:

```
OTEL_COLLECTOR_URL=http://otel-collector-<uuid>:4317
OTEL_METRIC_EXPORT_INTERVAL=30000
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1
LOG_LEVEL=info
```

The last three are the only settings that differ from local dev in kind rather than
value. Sampling matters most: the SDK default is `parentbased_always_on`, which records
every request — right for a dev stack, wrong for anything with real traffic. The SDK
reads both sampler variables natively, so this needs no code change. `NODE_ENV` is
already `production` in the image, and lands as `deployment_environment_name` on every
signal, so dashboards can tell production from a laptop pointed at the same stack.

Redeploy the API and look for `[otel] metrics exporting to http://otel-collector-...`
in its logs.

### Verifying it, with nothing published

The curls in "Verifying each hop" above assume published ports. In production nothing
is published, and the Tempo, Loki and Collector images are distroless — no shell, no
curl, so `docker exec` into them does not work either. Run a throwaway container on
the stack's network instead:

```bash
NET=$(docker network ls --format '{{.Name}}' | grep coolify)

# each hop, from inside the network
docker run --rm --network "$NET" curlimages/curl -s http://loki-<uuid>:3100/ready
docker run --rm --network "$NET" curlimages/curl -s http://tempo-<uuid>:3200/ready
docker run --rm --network "$NET" curlimages/curl -s http://prometheus-<uuid>:9090/-/healthy
docker run --rm --network "$NET" curlimages/curl -s http://otel-collector-<uuid>:8889/metrics | head
```

Grafana's own Explore covers most of what those answer, and it is one login away.

Only Prometheus and Grafana carry Docker healthchecks. That is not an oversight: the
other three images contain their binary and nothing else, so any healthcheck command
fails to *execute* and the container reports unhealthy forever — worse than having
none. Coolify falls back to container state for those three.

### Disk

Prometheus, Tempo and Loki all write to local volumes on the same disk as Postgres and
the API. Retention is 7 days for all three, and Prometheus additionally stops at 2GB.
Tempo and Loki are bounded by time only — if traces or logs ever crowd the disk, lower
`block_retention` in `infra/observability/tempo.yml` and `retention_period` in
`infra/observability/loki.yml` together, so the three signals keep ageing out as one.
