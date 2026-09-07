# Observability — Metrics Baseline Tasks

Legend: `[P]` = parallelisable with the other `[P]` tasks in the same group.

---

## T1 ✅ — Collector, Prometheus and Grafana config files [P]

**What**: Create `infra/observability/` with the Collector pipeline, Prometheus scrape config
and Grafana provisioning (datasource + dashboard provider).
**Where**: `infra/observability/otel-collector-config.yml`, `infra/observability/prometheus.yml`,
`infra/observability/grafana/provisioning/datasources/datasources.yml`,
`infra/observability/grafana/provisioning/dashboards/dashboards.yml`
**Depends on**: —
**Reuses**: shape of the removed configs in `62b4051^`, minus tempo/loki/alerting
**Done when**: Collector has one `metrics` pipeline (otlp → memory_limiter, batch → prometheus,
debug); Prometheus scrapes `otel-collector:8889` every 5s; datasource uid is `prometheus` and
`isDefault: true`; dashboard provider points at `/var/lib/grafana/dashboards`, folder `Tatame`.
**Requirements**: OBS-01, OBS-10, OBS-11
**Gate**: `docker run --rm -v ...:/etc/otelcol-contrib/config.yaml otel/opentelemetry-collector-contrib:0.160.0 validate`

---

## T2 ✅ — `docker-compose.observability.yml` [P]

**What**: Three services + two named volumes, no auth.
**Where**: `docker-compose.observability.yml`
**Depends on**: — (file paths agreed with T1)
**Done when**: `otel-collector` (contrib 0.160.0) publishes 4317/4318/8889; `prometheus`
(v3.13.3) publishes 9090 with `--web.enable-lifecycle`; `grafana` (13.0.8) publishes **3300**→3000
with `GF_AUTH_ANONYMOUS_ENABLED=true`, `GF_AUTH_ANONYMOUS_ORG_ROLE=Admin`,
`GF_AUTH_DISABLE_LOGIN_FORM=true`; volumes `tatame_prom_data`, `tatame_grafana_data`; base
`docker-compose.yml` is untouched.
**Requirements**: OBS-01, OBS-02, OBS-03
**Gate**: `docker compose -f docker-compose.yml -f docker-compose.observability.yml config` parses

---

## T3 ✅ — OTel dependencies in the API [P]

**What**: Add `@opentelemetry/api`, `sdk-node`, `auto-instrumentations-node`,
`exporter-metrics-otlp-grpc`, `sdk-metrics`, `resources`, `semantic-conventions` to
`apps/api/package.json` and install.
**Where**: `apps/api/package.json`, `pnpm-lock.yaml`
**Depends on**: —
**Done when**: `pnpm install` succeeds with no peer warnings for `@opentelemetry/*`.
**Requirements**: OBS-06, OBS-07
**Gate**: `pnpm install && pnpm --filter @tatame/api typecheck`

---

## T4 ✅ — Env schema

**What**: Add `OTEL_COLLECTOR_URL`, `OTEL_METRIC_EXPORT_INTERVAL`, `OTEL_SERVICE_NAME` as
optional entries; document them in `.env.example`.
**Where**: `packages/config/src/env.ts`, `.env.example`
**Depends on**: —
**Done when**: all three are optional; API boots with none of them set.
**Requirements**: OBS-04
**Gate**: `pnpm --filter @tatame/config build && pnpm --filter @tatame/api typecheck`

---

## T5 ✅ — `instrumentation.ts`

**What**: Metrics-only `NodeSDK`, guarded, with graceful shutdown flush.
**Where**: `apps/api/src/instrumentation.ts`
**Depends on**: T3, T4
**Done when**: no-ops unless `OTEL_COLLECTOR_URL` is set and `NODE_ENV !== "test"`; resource
carries `service.name` and `deployment.environment.name`; `PeriodicExportingMetricReader` with
the configured interval; `getNodeAutoInstrumentations()` with `@opentelemetry/instrumentation-fs`
disabled; `sdk.shutdown()` registered on SIGTERM/SIGINT; exactly one boot log line.
**Requirements**: OBS-04, OBS-05, OBS-06, OBS-07, OBS-08, OBS-09
**Gate**: `pnpm --filter @tatame/api typecheck && pnpm --filter @tatame/api lint`

---

## T6 ✅ — Wire it into the entrypoint

**What**: Import instrumentation as the second statement of `server.ts` (right after
`env-bootstrap`), before anything that pulls in express/pg/redis.
**Where**: `apps/api/src/server.ts`
**Depends on**: T5
**Done when**: `pnpm api:dev` boots clean with and without `OTEL_COLLECTOR_URL`; the existing
test suite is unaffected.
**Requirements**: OBS-04, OBS-09
**Gate**: `pnpm --filter @tatame/api test:unit`

---

## T7 ✅ — Verify the live pipeline and capture real metric names

**What**: Bring the stack up, run the API, generate traffic, then read the actual series from
`:8889/metrics` and Prometheus. Record the exact names in `design.md`.
**Where**: no source changes — verification only
**Depends on**: T1, T2, T5, T6
**Done when**:
  - `curl -s localhost:8889/metrics | grep -c http_server_request_duration` > 0 → confirms
    auto-instrumentation actually patched Express (D9 risk retired)
  - Node runtime series are present (`nodejs_*` / `process_*`)
  - `curl -s 'localhost:9090/api/v1/label/__name__/values'` lists the same names
  - the real names are written back into `design.md`
**Requirements**: OBS-06, OBS-07, OBS-12
**Gate**: all three curls above return data

---

## T8 ✅ — Grafana dashboard JSON

**What**: Hand-written dashboard with 7 panels using the names confirmed in T7.
**Where**: `infra/observability/grafana/dashboards/tatame-api-overview.json`
**Depends on**: T7
**Done when**: title `Tatame API — Overview`; every panel's datasource is
`{"type":"prometheus","uid":"prometheus"}`; panels: request rate by route, requests by status,
error rate %, latency p50/p95/p99, slowest routes, event loop delay, heap + CPU; after
provisioning and traffic, **no panel shows "No data"**.
**Requirements**: OBS-11, OBS-12
**Gate**: screenshot/manual check — every panel renders

---

## T9 ✅ — `docs/observability.md`

**What**: Short guide: the data path diagram, ports table, exact commands, one verification
curl per hop, and "how to add traces later".
**Where**: `docs/observability.md`
**Depends on**: T7, T8
**Done when**: a reader can go from clean checkout to a populated dashboard following only
this file.
**Requirements**: OBS-13
**Gate**: commands in the doc executed verbatim and all succeed

---

## T10 ✅ — Full regression + commit

**What**: `pnpm lint`, `pnpm typecheck`, `pnpm --filter @tatame/api test`, then one atomic
commit.
**Depends on**: T1–T9
**Requirements**: all
**Gate**: all three commands exit 0

---

## Traceability

| Requirement | Tasks |
| --- | --- |
| OBS-01 | T1, T2 |
| OBS-02 | T2 |
| OBS-03 | T2 |
| OBS-04 | T4, T5, T6 |
| OBS-05 | T5 |
| OBS-06 | T3, T5, T7 |
| OBS-07 | T3, T5, T7 |
| OBS-08 | T5 |
| OBS-09 | T5, T6 |
| OBS-10 | T1 |
| OBS-11 | T1, T8 |
| OBS-12 | T7, T8 |
| OBS-13 | T9 |

**Coverage:** 13 total, 13 mapped ✅


---

## Execution notes

- **T7 changed the design.** Importing `instrumentation.ts` first was not enough: in an
  ESM app `import express from "express"` bypasses the CommonJS require hook, so Express
  was never patched and HTTP metrics arrived with no `http_route` label. Fixed with
  `apps/api/otel-esm-hook.mjs` (`import-in-the-middle`, scoped to `express`) loaded via
  `node --import`. Recorded as D10 in design.md.
- **`process_*` metrics are not available.** Only `nodejs_*`/`v8js_*` runtime metrics
  exist; process CPU/RSS would need `instrumentation-host-metrics`. The dashboard uses
  event-loop metrics instead, so T8's "process CPU" panel became "GC time / s".
- **Deduped `@opentelemetry/api`.** Installing it at 1.9.0 while the workspace resolved
  1.9.1 gave drizzle-orm two type identities and broke `tsc`. Pinned to 1.9.1 via
  `pnpm.overrides`.
- **ESLint config.** `recommendedTypeChecked` applied to the new `.mjs` file, which is
  outside the TS project; type-aware rules are now disabled for `**/*.mjs`.
