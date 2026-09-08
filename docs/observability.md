# Observability — metrics with OpenTelemetry

A local, free monitoring stack for the API: **OpenTelemetry SDK → OTel Collector →
Prometheus → Grafana**. Only metrics for now; traces and logs are a later iteration.

## The data path

```
apps/api (Node)                    push, OTLP/gRPC
  └── @opentelemetry/sdk-node ──────────────────────► otel-collector :4317
        auto-instrumentations                              │
        (http, express, pg, redis, node runtime)           │ exposes /metrics
                                                           ▼
                                              otel-collector :8889 ◄── scrape ── prometheus :9090
                                                                                      │
                                                                                      ▼
                                                                                 grafana :3300
```

The API only ever talks to the Collector. Everything downstream is infrastructure
config — adding Tempo (traces) or Loki (logs) later means adding a pipeline in
`infra/observability/otel-collector-config.yml`, not changing application code.

| Port | Who | What |
| --- | --- | --- |
| 4317 | otel-collector | OTLP **gRPC** — where the API pushes |
| 4318 | otel-collector | OTLP HTTP — for manual pokes with curl |
| 8889 | otel-collector | Prometheus scrape endpoint (`/metrics`) |
| 9090 | prometheus | Query API + web UI |
| 3300 | grafana | Dashboards (3000 on the host belongs to `next dev`) |

## Running it

```bash
# 1. start the stack (base compose + observability compose)
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d

# 2. tell the API where the Collector is (repo-root .env)
echo 'OTEL_COLLECTOR_URL=http://localhost:4317' >> .env

# 3. run the API as usual
pnpm api:dev

# 4. open Grafana → Dashboards → Tatame → "Tatame API — Overview"
open http://localhost:3300
```

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

## What you get for free

No business code was changed. Everything below comes from `getNodeAutoInstrumentations()`:

| Series | From | Useful labels |
| --- | --- | --- |
| `http_server_request_duration_seconds_{bucket,count,sum}` | `instrumentation-http` | `http_route`, `http_request_method`, `http_response_status_code` |
| `http_client_request_duration_seconds_*` | `instrumentation-http` | outgoing HTTP calls |
| `nodejs_eventloop_delay_{p50,p90,p99,...}_seconds`, `nodejs_eventloop_utilization_ratio` | `instrumentation-runtime-node` | — |
| `v8js_memory_heap_used_bytes`, `v8js_gc_duration_seconds_*` | `instrumentation-runtime-node` | `v8js_heap_space_name`, `v8js_gc_type` |

Every series also carries `service_name`, `service_instance_id` and
`deployment_environment_name`, copied from the SDK's resource attributes by the
Collector (`resource_constant_labels` in the Collector config).

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
| `docker-compose.observability.yml` | Collector + Prometheus + Grafana |
| `infra/observability/otel-collector-config.yml` | Receivers, processors, exporters |
| `infra/observability/prometheus.yml` | Scrape targets |
| `infra/observability/grafana/provisioning/` | Datasource + dashboard provider |
| `infra/observability/grafana/dashboards/` | Dashboard JSON (edit on disk, Grafana reloads in ~10s) |

## Adding traces next

1. Add `@opentelemetry/exporter-trace-otlp-grpc` and pass a `traceExporter` to the
   `NodeSDK` (replacing the explicit `spanProcessors: []`).
2. Add a `tempo` service and a `traces` pipeline in the Collector config
   (`otlp` receiver → `otlphttp/tempo` exporter).
3. Add a Tempo datasource to `datasources.yml` with its own `uid`.

Same for logs with Loki. The application-side change is one line each time — that is
the point of routing everything through the Collector.

## No auth

Grafana runs with anonymous admin access and no login form. That is fine for
`localhost`; anything exposed to a network needs `GF_AUTH_ANONYMOUS_ENABLED=false`
and real credentials.
