# Observability — Metrics Baseline Design

## Data Path

```
apps/api (Node, host or container)
  │  OTLP/gRPC :4317   — PeriodicExportingMetricReader, push every 10s
  ▼
otel-collector (contrib 0.160.0)
  │  receivers.otlp → processors[memory_limiter, batch] → exporters[prometheus, debug]
  │  exposes a scrape endpoint on :8889/metrics
  ▼
prometheus (v3.13.3)  — scrapes otel-collector:8889 every 5s, stores in TSDB
  ▼
grafana (13.0.8) :3300 — provisioned datasource + dashboard, anonymous admin
```

Push (SDK → Collector) then pull (Prometheus → Collector). The Collector is the single entry
point, so adding Tempo/Loki later means adding a pipeline there — not touching the API again.

## Decisions

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | Metrics only; no trace/log exporter configured | User asked for the smallest understandable slice. A `traceExporter` is deliberately absent so no data is produced that nothing consumes. |
| D2 | Collector `prometheus` exporter (pull) instead of `prometheusremotewrite` (push) | One less moving part, and `curl :8889/metrics` is a directly inspectable hop — the previous stack's fatal flaw was an unexposed intermediate. Requires the **contrib** image. |
| D3 | Separate `docker-compose.observability.yml`, no profiles | Opt-in via `-f` composition; the base file stays untouched for people who just want postgres+redis. |
| D4 | Grafana on host port **3300**, not 3000 | `apps/web` (`next dev`) already owns 3000. |
| D5 | `getNodeAutoInstrumentations()` with `instrumentation-fs` disabled | Full auto coverage (http, express, pg, redis, undici, runtime-node, host-metrics) with one package; `fs` is famously noisy and adds no metric value. |
| D6 | Guard on `OTEL_COLLECTOR_URL` presence + `NODE_ENV !== "test"` | Keeps dev/test/CI runs clean and makes the feature strictly additive (OBS-04, OBS-05, OBS-09). |
| D7 | Metric names taken from **stable** HTTP semconv | `@opentelemetry/instrumentation-http` ≥ 0.222.0 emits `http.server.request.duration` in **seconds** (verified in the package's built source), not the legacy `http.server.duration` in ms. Community dashboards from tutorials query the legacy names and would show "No data" — hence a hand-written dashboard (OBS-12). |
| D8 | Export interval env-tunable, default 10s | 60s is unusable for a live demo, 1s competes with the app. `OTEL_METRIC_EXPORT_INTERVAL` overrides. |
| D9 | Instrumentation imported as the very first statement of `server.ts` | Auto-instrumentation must patch `http`/`express` before they are loaded. |
| D10 | Extra `--import ./otel-esm-hook.mjs` ESM loader hook, scoped to `express` | **Found in T7:** importing first is not enough. `http` (builtin) and `undici` (diagnostics channel) get patched, but `import express from "express"` in an ESM app bypasses the CommonJS require hook, so Express was never patched and every HTTP metric came back **without `http_route`**. `import-in-the-middle` hooks the ESM loader and fixes it. Scoped to `express` because wrapping everything makes the loader rewrite the app's own modules and drizzle-orm's barrel re-exports, which crashes at boot with `conflicting star exports for name 'and'`. The hook must register unconditionally: `--import` runs before `env-bootstrap.js` loads `.env`, so guarding it on `OTEL_COLLECTOR_URL` disabled it for exactly the documented setup and silently dropped `http_route`. |

## Components

| Component | Path | Responsibility |
| --- | --- | --- |
| SDK bootstrap | `apps/api/src/instrumentation.ts` | Build + start `NodeSDK` (metrics only), register shutdown flush |
| Env schema | `packages/config/src/env.ts` | `OTEL_COLLECTOR_URL`, `OTEL_METRIC_EXPORT_INTERVAL`, `OTEL_SERVICE_NAME` — all optional |
| Entry hook | `apps/api/src/server.ts` | First import, before `env-bootstrap` side effects are needed |
| Collector config | `infra/observability/otel-collector-config.yml` | otlp in → prometheus out |
| Prometheus config | `infra/observability/prometheus.yml` | scrape `otel-collector:8889` + self |
| Grafana datasource | `infra/observability/grafana/provisioning/datasources/datasources.yml` | uid `prometheus`, default |
| Grafana dashboard provider | `infra/observability/grafana/provisioning/dashboards/dashboards.yml` | load JSON from `/var/lib/grafana/dashboards` into folder `Tatame` |
| Dashboard | `infra/observability/grafana/dashboards/tatame-api-overview.json` | 7 panels, hand-written PromQL |
| Compose | `docker-compose.observability.yml` | 3 services + 2 named volumes |
| Guide | `docs/observability.md` | data path, commands, per-hop verification |

## Env-var contract

| Var | Default | Notes |
| --- | --- | --- |
| `OTEL_COLLECTOR_URL` | unset → SDK disabled | `http://localhost:4317` from the host, `http://otel-collector:4317` from a container |
| `OTEL_METRIC_EXPORT_INTERVAL` | `10000` (ms) | Lower for demos |
| `OTEL_SERVICE_NAME` | `tatame-api` | Becomes the `job`/`service_name` label |

## Ordering / import-order risk

`server.ts` currently starts with `import "./env-bootstrap.js"`, which loads the root `.env`.
The instrumentation module needs those vars, so the order must be:

```ts
import "./env-bootstrap.js";     // 1. populate process.env
import "./instrumentation.js";   // 2. patch http/express/pg/redis, start SDK
import ...rest                   // 3. everything else
```

ESM evaluates imports top-down, so `instrumentation.ts` still runs before `express` is
imported by `app.ts`. This is the assumption T7 verifies against the real `:8889/metrics`
output — if HTTP metrics are missing, fall back to `NODE_OPTIONS='--import ./src/instrumentation.ts'`.

## Metric names — verified against the live stack (T7)

Read from `localhost:9090/api/v1/label/__name__/values` after real traffic, not from docs:

| Source | Series | Notable labels |
| --- | --- | --- |
| `instrumentation-http` | `http_server_request_duration_seconds_{bucket,count,sum}` (seconds) | `http_route`, `http_request_method`, `http_response_status_code`, `url_scheme` |
| `instrumentation-http` | `http_client_request_duration_seconds_*` | outgoing calls |
| `instrumentation-runtime-node` | `nodejs_eventloop_delay_{min,mean,p50,p90,p99,max,stddev}_seconds`, `nodejs_eventloop_utilization_ratio`, `nodejs_eventloop_time_seconds_total` | — |
| `instrumentation-runtime-node` | `v8js_memory_heap_used_bytes`, `v8js_memory_heap_space_size_bytes`, `v8js_gc_duration_seconds_*` | `v8js_heap_space_name`, `v8js_gc_type` |
| resource attributes | added to every series | `service_name`, `service_instance_id`, `deployment_environment_name` |

Two findings that changed the plan:

- **`process_*` (CPU, RSS) is not produced by the Node app.** The only
  `process_cpu_seconds_total` in Prometheus belongs to Prometheus' own Go process
  (`job="prometheus"`). Process/host metrics would need `instrumentation-host-metrics`,
  which is not enabled by default. The dashboard uses event-loop utilization instead.
- **Prometheus renames the collector's `job`/`instance`.** The exporter emits
  `job="tatame-api"`, but the scrape target's own `job="otel-collector"` wins and the
  original is kept as `exported_job`. Dashboards therefore filter on `service_name`.

## Dashboard queries (confirmed against live series in T7)


| Panel | PromQL |
| --- | --- |
| Request rate by route | `sum by (http_route) (rate(http_server_request_duration_seconds_count[1m]))` |
| Error rate % | `100 * sum(rate(http_server_request_duration_seconds_count{http_response_status_code=~"5.."}[5m])) / sum(rate(http_server_request_duration_seconds_count[5m]))` |
| Latency p50/p95/p99 | `histogram_quantile(0.95, sum by (le) (rate(http_server_request_duration_seconds_bucket[5m])))` |
| Requests by status | `sum by (http_response_status_code) (rate(http_server_request_duration_seconds_count[1m]))` |
| Event loop delay p99 | `nodejs_eventloop_delay_p99_seconds` (confirmed) |
| Heap used | `sum by (v8js_heap_space_name) (v8js_memory_heap_used_bytes)` |
| Slowest routes | `topk(5, histogram_quantile(0.95, sum by (le, http_route) (rate(http_server_request_duration_seconds_bucket[5m]))))` |

## Rollback

Every change is additive and gated on an env var. Removing `OTEL_COLLECTOR_URL` from `.env`
returns the API to its exact current behaviour; `docker compose -f docker-compose.observability.yml down -v`
removes the infra.
