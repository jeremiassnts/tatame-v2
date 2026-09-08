# Tasks — Traces (Tempo) + APM dashboard

Sequence matters: infra must be up before the SDK has somewhere to push, and the dashboard
can only be verified once both label and trace data exist.

| # | Task | Covers | Status |
| --- | --- | --- | --- |
| T1 | Tempo service + `infra/observability/tempo.yml` | R5 | done |
| T2 | Collector: `service.namespace` constant label + traces pipeline → Tempo | R4, R7 | done |
| T3 | Grafana: provision the `tempo` datasource | R6 | done |
| T4 | API SDK: `service.namespace` on the Resource + OTLP trace exporter | R1, R2, R3, R7 | done |
| T5 | Build the cleaned APM dashboard JSON | R9, R10, D4 | done |
| T6 | Docs + `.env.example` | R12 | done |
| T7 | Verify end to end against a live stack | R6, R7, R8 | done |

All seven verified on 2026-09-08 against a live stack with `pnpm load-test`:
variable chain resolves `development` → `tatame` → `tatame-api`; Tempo returns
spans for `{resource.service.name="tatame-api"}`; both dashboards render with zero
console errors (one expected warning for the absent Loki datasource).

---

## T1 — Tempo

**Where:** `infra/observability/tempo.yml` (new), `docker-compose.observability.yml`
**Done when:** `docker compose ... up -d tempo` is healthy and `curl :3200/ready` returns ready.
- `grafana/tempo:3.0.3`, monolithic mode, `backend: local`, `usage_report.reporting_enabled: false`
- `stream_over_http_enabled: true` so Grafana's TraceQL streaming works
- Named volume `tatame_tempo_data:/var/tempo`; `user: "0"` because the image runs as uid 10001
  and a fresh named volume is root-owned
- Publish 3200 (query API). Do **not** publish Tempo's own 4317 — that port already belongs
  to the Collector on the host; the Collector reaches Tempo over the compose network.

## T2 — Collector

**Where:** `infra/observability/otel-collector-config.yml`
**Done when:** `docker compose logs otel-collector` shows a `traces` pipeline and no config error.
- Add `service.namespace` to `exporters.prometheus.resource_constant_labels.included`
- Add `exporters.otlp/tempo` → `tempo:4317`, `tls.insecure: true`
- Add `service.pipelines.traces` = receivers `[otlp]`, processors `[memory_limiter, batch]`,
  exporters `[otlp/tempo, debug]`

## T3 — Tempo datasource

**Where:** `infra/observability/grafana/provisioning/datasources/datasources.yml`
**Done when:** Grafana → Connections → Tempo → "Save & test" passes.
- `uid: tempo` — fixed, the dashboard references it by uid

## T4 — API SDK

**Where:** `apps/api/package.json`, `apps/api/src/instrumentation.ts`
**Reuses:** the existing `collectorUrl` / `nodeEnv` guards — traces must not invent a second
opt-in mechanism.
**Done when:** `pnpm api:dev` logs the trace line and `pnpm --filter @tatame/api typecheck` passes.
- Add `@opentelemetry/exporter-trace-otlp-grpc@0.222.0` (pinned to the other 0.222.0 packages)
- `ATTR_SERVICE_NAMESPACE` on the Resource, from `OTEL_SERVICE_NAMESPACE`, default `tatame`
- `OTEL_TRACES_ENABLED=false` disables traces while leaving metrics on (R3)
- Set `traceExporter` (NodeSDK wraps it in a BatchSpanProcessor) when enabled; keep
  `spanProcessors: []` when not, so the SDK never falls back to `OTEL_TRACES_EXPORTER`
**Gate:** `pnpm --filter @tatame/api typecheck && pnpm --filter @tatame/api lint`

## T5 — Dashboard

**Where:** `scripts/build-apm-dashboard.mjs` (new), `infra/observability/grafana/dashboards/otel-service-apm.json`
**Done when:** the JSON parses, has no `${DS_...}` reference left, and Grafana provisions it
without error.
Written as a script, not a hand-edit, so the transformation from upstream rev7 is reviewable
and re-runnable when the dashboard is updated upstream.
- Strip `__inputs`, `__elements`, `__requires`, `gnetId`; `id: null`
- `${DS_GRAFANACLOUD-CLECLERC-PROM}` → `${prometheus_datasource}`, `-TRACES` → `${tempo_datasource}`,
  `-LOGS` → `${loki_datasource}`
- Pin `current` on the `prometheus_datasource` / `tempo_datasource` variables to our uids
- Delete the setup-instructions text panel (D4)
- Delete `Server RPC RED Metrics` row, `RPC Operations`, `Outbound RPC Services` (D2)
- Replace the JVM table in `Runtime` with Node panels (D2)
- Move `Latest logs received` into the `Logs` row and collapse it (D3)
- `uid: otel-service-apm`, tags `["tatame", "otel"]`
**Gate:** `node scripts/build-apm-dashboard.mjs --check`

## T6 — Docs

**Where:** `docs/observability.md`, `.env.example`
**Done when:** the doc's data-path diagram and port table include Tempo, and restoring Loki
is written down.

## T7 — Verification

**Done when, against a live stack with `pnpm load-test` running:**
1. `label_values(target_info, service_name)` returns `tatame-api`
2. `label_values(target_info, service_namespace)` returns `tatame`
3. Tempo returns traces for `{resource.service.name="tatame-api"}`
4. APM dashboard HTTP RED panels render
5. `tatame-api-overview` still renders (R8)
