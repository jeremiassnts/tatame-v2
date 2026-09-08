# Observability — metrics and traces with OpenTelemetry

A local, free monitoring stack for the API: **OpenTelemetry SDK → OTel Collector →
Prometheus (metrics) + Tempo (traces) → Grafana**. Logs are a later iteration.

## The data path

```
apps/api (Node)                    push, OTLP/gRPC
  └── @opentelemetry/sdk-node ──────────────────────► otel-collector :4317
        auto-instrumentations                              │
        (http, express, redis, node runtime)               ├── exposes /metrics
                                                           │        │
                                              otel-collector :8889 ◄─┴─ scrape ── prometheus :9090
                                                           │                            │
                                                           └── push, OTLP/gRPC ──► tempo :4317
                                                                                        │
                                                                    grafana :3300 ◄──────┘
```

The API only ever talks to the Collector, and both signals ride the same connection.
Everything downstream is infrastructure config — adding Loki later means adding a
pipeline in `infra/observability/otel-collector-config.yml`, not changing application
code.

| Port | Who | What |
| --- | --- | --- |
| 4317 | otel-collector | OTLP **gRPC** — where the API pushes metrics *and* traces |
| 4318 | otel-collector | OTLP HTTP — for manual pokes with curl |
| 8889 | otel-collector | Prometheus scrape endpoint (`/metrics`) |
| 9090 | prometheus | Query API + web UI |
| 3200 | tempo | Query API — `curl :3200/ready`, and where Grafana reads traces |
| 3300 | grafana | Dashboards (3000 on the host belongs to `next dev`) |

Tempo also listens on 4317 inside the compose network, but that port is deliberately
**not** published: on the host it belongs to the Collector.

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
| `apps/api/otel-esm-hook.mjs` | ESM loader hook (see above) |
| `scripts/load-test.mjs` | Traffic generator (`pnpm load-test`) |
| `scripts/build-apm-dashboard.mjs` | Adapts the upstream APM dashboard to this stack |
| `docker-compose.observability.yml` | Collector + Prometheus + Tempo + Grafana |
| `infra/observability/otel-collector-config.yml` | Receivers, processors, exporters |
| `infra/observability/prometheus.yml` | Scrape targets and `target_info` relabeling |
| `infra/observability/tempo.yml` | Tempo, monolithic mode, traces on local disk |
| `infra/observability/upstream/` | Vendored third-party dashboards, never edited |
| `infra/observability/grafana/provisioning/` | Datasource + dashboard provider |
| `infra/observability/grafana/dashboards/` | Dashboard JSON (edit on disk, Grafana reloads in ~10s) |

## Traces

Sampling is the SDK default, `parentbased_always_on` — every request is recorded. That
is right for a dev stack and wrong for anything with real traffic; when that day comes,
set `OTEL_TRACES_SAMPLER=parentbased_traceidratio` and `OTEL_TRACES_SAMPLER_ARG=0.1`.
The SDK reads both natively, so it needs no code change.

Traces are retained for 7 days (`backend_worker.compaction.block_retention` in
`infra/observability/tempo.yml`), matching Prometheus.

## Adding Loki next

The APM dashboard already contains the two log panels, parked inside the collapsed
**Logs** row at the bottom. To light them up:

1. Add a `loki` service to `docker-compose.observability.yml`.
2. Add a `loki` exporter and a `logs` pipeline to the Collector config, plus a log
   record processor on the SDK side.
3. Add a Loki datasource with `uid: loki` to `datasources.yml` — the dashboard's
   `loki_datasource` variable resolves by type, so nothing in the JSON has to change.
4. Un-collapse the row: set `collapsed: false` for the `Logs` section in
   `scripts/build-apm-dashboard.mjs` and re-run it.

The application-side change is one exporter — that is the point of routing everything
through the Collector.

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
| Moves the Loki panels into a collapsed row | Loki is not deployed; nothing referencing a missing datasource should render on load |
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

## No auth

Grafana runs with anonymous admin access and no login form. That is fine for
`localhost`; anything exposed to a network needs `GF_AUTH_ANONYMOUS_ENABLED=false`
and real credentials.
