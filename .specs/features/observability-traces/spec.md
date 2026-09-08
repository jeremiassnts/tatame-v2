# Feature: Traces (Tempo) + APM dashboard

**Status:** In progress
**Branch:** `feat/observability-rework`
**Builds on:** `.specs/features/observability-metrics`

## Problem

The stack ships metrics only (`SDK → Collector → Prometheus → Grafana`). There is no way to
see *where* a slow request spent its time — only that it was slow. We want the first,
deliberately basic slice of tracing, plus the community "Lightweight APM for OpenTelemetry"
dashboard (Grafana ID 22784 rev7) alongside the existing `tatame-api-overview`.

Logs/Loki are explicitly **out of scope** for this iteration.

## Requirements

| ID | Requirement |
| --- | --- |
| R1 | The API exports spans over OTLP/gRPC to the Collector, using the same `OTEL_COLLECTOR_URL` already used for metrics. |
| R2 | Tracing follows the same opt-in rules as metrics: off when `OTEL_COLLECTOR_URL` is unset, off under `NODE_ENV=test`. |
| R3 | Tracing can be turned off independently of metrics, without unsetting `OTEL_COLLECTOR_URL`. |
| R4 | The Collector routes traces to Tempo; adding Tempo requires no application code change beyond R1. |
| R5 | Tempo runs in `docker-compose.observability.yml`, dev-only, no auth, local filesystem storage. |
| R6 | Grafana has a provisioned `tempo` datasource; the APM dashboard's Tempo panels return data. |
| R7 | The APM dashboard's template variables (`deployment_environment_name` → `service_namespace` → `service_name`) resolve against `target_info`. |
| R8 | The existing `tatame-api-overview` dashboard keeps working unchanged. |
| R9 | Loki panels stay in the JSON but inert: nothing that references Loki renders outside a collapsed row. |
| R10 | The APM dashboard shows no permanently-empty panels for signals this service cannot produce (JVM, gRPC server). |
| R11 | The imported dashboard JSON contains no active content (scripts, iframes, remote code). |
| R12 | `docs/observability.md` covers the trace path, the new ports/vars, and how to restore Loki later. |

## Decisions

- **D1 — `target_info` labels (R7).** The Collector's `prometheus` exporter maps
  `service.name → job` and `service.instance.id → instance`; the Prometheus scrape then
  renames those to `exported_job` / `exported_instance`. So `target_info` carries neither
  `service_name` nor `service_namespace` today, and the dashboard's variable chain comes
  back empty.
  **Chosen:** add `service.namespace` to the SDK Resource and to the exporter's
  `resource_constant_labels.included`, so both labels land on every series *including*
  `target_info`. Keeps the existing scrape path untouched.
  **Rejected:** switching to Prometheus' native OTLP receiver with
  `keep_identifying_resource_attributes` + `promote_resource_attributes`. It is the design
  the dashboard was written for, but it replaces a metrics path that already works.
  *Impact on R8:* `service.name` was already a constant label; only `service_namespace` is
  new. `tatame-api-overview` filters on `service_name` and aggregates with `sum by (...)`,
  so no query breaks — the only effect is one-time series churn at the config change.

- **D2 — panels that cannot apply (R10).** The `Runtime` row is JVM-only and there is no
  gRPC server in this project.
  **Chosen:** rewrite `Runtime` against the Node metrics already being emitted
  (`nodejs_eventloop_delay_*`, `v8js_memory_heap_used_bytes`, `v8js_gc_duration_seconds`)
  and delete the gRPC rows/panels.

- **D3 — Loki (R9).** Keep the Loki panels in the JSON for a later iteration, but collapse
  them out of sight. The `Latest logs received` stat sits in the always-visible header row
  upstream, so it moves down into the collapsed `Logs` row rather than erroring on load.

- **D4 — setup panel.** The upstream `Dashboard setup instructions` text panel is deleted.
  It says "delete this panel after setup", and its instructions describe the Prometheus
  native-OTLP path rejected in D1 — leaving it in would document the wrong architecture.

- **D5 — Tempo version.** `grafana/tempo:3.0.3`. Tempo 3.0 is an architecture break:
  the `compactor` and `ingester` components are gone, so `compactor.compaction.*`
  moved to `backend_worker.compaction.*`. Monolithic mode still works with local
  storage and needs no Kafka.

- **D6 — sampling.** Head sampling stays at the SDK default (`parentbased_always_on`) for
  this first slice. `OTEL_TRACES_SAMPLER` / `OTEL_TRACES_SAMPLER_ARG` are read natively by
  the SDK, so tuning it later needs no code change.

## Security review of the imported dashboard (R11)

`22784_rev7.json`, 92 KB, from
<https://github.com/cyrille-leclerc/opentelemetry-service-dashboard>.

| Check | Result |
| --- | --- |
| `<script>` / `<iframe>` / `javascript:` URIs | 0 occurrences |
| Inline event handlers (`onerror=`, `onload=`, …) | 0 |
| `eval(` / `fetch(` / `XMLHttpRequest` / `document.` / `window.` | 0 |
| `data:` / base64 blobs | 0 |
| Dashboard-level `links` | empty array |
| Annotations | only the built-in Grafana annotation |
| Panel types | text, stat, row, timeseries, table, logs — all core, no third-party plugins |
| External URLs | 14, all `opentelemetry.io` / `prometheus.io` / `grafana.com` / `github.com` docs links |

**Verdict: clean.** Grafana sanitizes HTML in text panels unless `disable_sanitize_html` is
set, which this stack does not set.

One residual note, not a vulnerability: the header text panel embeds
`https://opentelemetry.io/img/logos/opentelemetry-logo-nav.png`, so opening the dashboard
makes one outbound request to `opentelemetry.io`. Kept as-is — it is a dev-only stack.

## Found during implementation

These are not design choices — they are things the stack turned out to do, each
verified against a live run.

- **`target_info` needed relabeling, constant labels were not enough.** D1 assumed
  `resource_constant_labels` would land on every series. It does not land on
  `target_info`: that series is generated by the exporter from the resource, which
  maps `service.namespace` + `service.name` into `job` per the OTLP-to-Prometheus
  spec, and Prometheus renames it to `exported_job` on scrape. Fixed with
  `metric_relabel_configs` in `infra/observability/prometheus.yml`, scoped to
  `target_info`, splitting `exported_job="tatame/tatame-api"` back into the two
  labels. D1's conclusion holds; its mechanism needed one more piece.

- **`includeAll` broke both signals.** Upstream ships `service_namespace` and
  `deployment_environment_name` with All enabled and no `allValue`. TraceQL compares
  exactly, so the interpolated All made Tempo answer 400; in PromQL an All that
  resolves before its values load interpolates to nothing, giving `=~""`, which
  matches only series *missing* the label — every panel read "No data". Both
  variables now have All disabled, which also fixes the header rendering
  `(env: .*)` as prose.

- **Tempo's TraceQL metrics limit is 24h by default.** Grafana asks for a wider
  window than the dashboard's time picker shows, so `Latest traces received` was a
  permanent 400 regardless of the selected range. `query_frontend.metrics.max_duration`
  is now `168h`, matching retention.

- **Postgres is not traced, and cannot be without more work.** `packages/db` uses
  `postgres` (postgres.js); `@opentelemetry/instrumentation-pg` patches `pg`. Two
  different libraries, so it never activates — there are no Postgres spans and no
  `db_client_operation_duration_seconds`, which is why `Outbound Databases` reads
  "No database call". Redis, Express and HTTP are fully traced. Kept the panel
  rather than deleting it under D2/R10: this is a gap to close, not a signal this
  service cannot produce, and hiding the panel would hide the gap.

## Out of scope

- Loki / log correlation (R9 keeps the door open)
- Tempo metrics-generator (span metrics, service graphs) and exemplars
- Trace → metric / metric → trace datasource linking
- Tail sampling, any non-default sampler
- Anything outside `apps/api` (web, mobile)
