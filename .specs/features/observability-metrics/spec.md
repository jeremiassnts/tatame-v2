# Observability — Metrics Baseline Specification

## Problem Statement

The API runs blind. The previous observability stack was removed in `62b4051` because it
shipped broken (Prometheus scraped an endpoint that was never exposed, dashboards
referenced datasource UIDs that did not exist, logs went through two competing paths).
We need a small, correct, verifiable baseline that answers "how is the API behaving right
now?" — and that the developer fully understands before anything more complex is added.

## Goals

- [x] A single `docker compose` command brings up Collector + Prometheus + Grafana locally
- [x] The API exports metrics with zero business-code changes (auto-instrumentation only)
- [x] Grafana shows request rate, error rate, latency percentiles and Node runtime health
      for the API within 30s of a request being served
- [x] Every panel query is written against metric names verified from the live stack,
      not copied from a tutorial

## Out of Scope

| Feature | Reason |
| --- | --- |
| Traces (Tempo/Jaeger) | Deferred to a second iteration — metrics first, understood fully |
| Logs (Loki, structured logger) | Deferred; `console.*` stays as-is for now |
| Alerting rules / Discord notifications | Needs stable metrics first; no value while learning |
| Custom business metrics (check-ins, signups) | Auto-instrumentation baseline only |
| Production/Coolify deployment, auth, TLS | Local dev only; user explicitly asked for no passwords |
| node-exporter / host metrics of the Docker host | Container-level noise while learning; API process metrics suffice |
| Mobile and web app instrumentation | Backend only |

---

## User Stories

### P1: Run the observability stack locally ⭐ MVP

**User Story**: As the developer, I want to start Collector, Prometheus and Grafana with one
command so that I can look at API telemetry without signing up for a paid vendor.

**Why P1**: Nothing else can be verified until the pipeline is up.

**Acceptance Criteria**:

1. WHEN the developer runs the documented `docker compose ... up -d` command THEN the system
   SHALL start exactly four containers: `otel-collector`, `prometheus`, `grafana` (plus the
   existing `postgres` and `redis` when the base file is included).
2. WHEN the developer opens `http://localhost:3300` THEN Grafana SHALL load without asking
   for credentials (anonymous admin, local dev only).
3. WHEN the observability compose file is NOT included THEN `docker compose up` SHALL behave
   exactly as before (postgres + redis only), so the stack is opt-in.
4. WHEN the developer runs `docker compose ... down` THEN all observability containers SHALL
   stop and Prometheus/Grafana data SHALL survive in named volumes.

**Independent Test**: `docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d`
then `docker compose ps` shows the services healthy and `curl localhost:9090/-/ready` returns ready.

---

### P2: Export API metrics through the Collector ⭐ MVP

**User Story**: As the developer, I want the API to push OpenTelemetry metrics to the
Collector so that all telemetry has one central entry point I can later fan out.

**Why P1-level but listed P2**: Depends on P1 being up; still required for MVP.

**Acceptance Criteria**:

1. WHEN `OTEL_COLLECTOR_URL` is set THEN the API SHALL start the OpenTelemetry Node SDK and
   log `[otel] metrics exporting to <url>` once at boot.
2. WHEN `OTEL_COLLECTOR_URL` is unset THEN the API SHALL start normally, skip SDK
   initialisation, and log that observability is disabled — no crash, no retry storm.
3. WHEN the Collector is unreachable while `OTEL_COLLECTOR_URL` is set THEN the API SHALL
   keep serving requests, and export failures SHALL NOT propagate to request handling.
4. WHEN the API serves HTTP requests THEN it SHALL emit `http.server.request.duration`
   histogram data with `http.route`, `http.request.method` and `http.response.status_code`
   attributes, without any change to route handlers.
5. WHEN the API process runs THEN it SHALL emit Node runtime metrics (event loop delay/
   utilization, heap, GC) via auto-instrumentation.
6. WHEN the API receives SIGTERM or SIGINT THEN it SHALL flush pending metrics before exit.
7. WHEN the API runs the test suite THEN the SDK SHALL NOT start (no exporter noise in tests).

**Independent Test**: with the stack up and `OTEL_COLLECTOR_URL` set, `curl localhost:3001/health`
a few times, then `curl -s localhost:8889/metrics | grep http_server_request_duration` returns series.

---

### P3: See the API in Grafana ⭐ MVP

**User Story**: As the developer, I want a pre-provisioned Grafana dashboard so that I can
see request rate, errors and latency without building panels by hand.

**Why MVP**: The whole point of the exercise is the visual feedback loop.

**Acceptance Criteria**:

1. WHEN Grafana starts THEN a `Prometheus` datasource SHALL be provisioned automatically with
   a fixed UID, and be the default datasource.
2. WHEN Grafana starts THEN a dashboard named `Tatame API — Overview` SHALL appear under a
   `Tatame` folder without any manual import.
3. WHEN the dashboard is opened after traffic has been served THEN every panel SHALL render
   data (no "No data"), covering: request rate by route, error rate (5xx share), latency
   p50/p95/p99, in-flight/active requests, event loop delay, heap usage and process CPU.
4. WHEN a panel query is written THEN it SHALL reference the datasource by the provisioned
   UID so the dashboard is not bound to a manually created datasource.

**Independent Test**: generate traffic, open the dashboard, confirm all panels show values.

---

### P4: Understand and reproduce the setup

**User Story**: As the developer, I want a short guide explaining each moving part so that I
can extend the stack myself later.

**Why P4**: Doesn't block the pipeline, but is the stated purpose ("quando eu entender bem
como funciona eu vou deixando mais complexo").

**Acceptance Criteria**:

1. WHEN the developer reads `docs/observability.md` THEN it SHALL explain the data path
   (SDK → Collector → Prometheus → Grafana), the ports involved, and how to add a new signal.
2. WHEN the developer wants to run everything THEN the doc SHALL contain the exact commands.
3. WHEN the developer wants to verify each hop THEN the doc SHALL contain one curl per hop.

---

## Edge Cases

- WHEN `OTEL_COLLECTOR_URL` points at a hostname that does not resolve THEN the SDK SHALL log
  export errors on its own interval and the API SHALL stay healthy.
- WHEN the API runs inside Docker THEN the Collector host SHALL be reachable as
  `otel-collector:4317`; when the API runs on the host, as `localhost:4317`.
- WHEN Prometheus scrapes before the API has exported anything THEN the target SHALL still be
  `UP` (the Collector's Prometheus exporter answers with zero series, not an error).
- WHEN two API processes export at once (e.g. `pnpm api:dev` plus a container) THEN metrics
  SHALL be distinguishable by the `service.instance.id` / `deployment.environment.name`
  resource attributes.
- WHEN the metric export interval is shortened for demos THEN it SHALL be configurable by env
  var, not hardcoded.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| OBS-01 | P1: Stack starts with one command, opt-in via separate compose file | Execute | Verified |
| OBS-02 | P1: Grafana reachable at :3300 with no login | Execute | Verified |
| OBS-03 | P1: Named volumes persist Prometheus/Grafana data | Execute | Verified |
| OBS-04 | P2: SDK boots only when `OTEL_COLLECTOR_URL` is set, logs once | Execute | Verified |
| OBS-05 | P2: API unaffected when collector is absent/unreachable | Execute | Verified |
| OBS-06 | P2: HTTP server metrics with route/method/status attributes | Execute | Verified |
| OBS-07 | P2: Node runtime metrics (event loop, heap, GC) | Execute | Verified |
| OBS-08 | P2: Graceful flush on SIGTERM/SIGINT | Execute | Verified |
| OBS-09 | P2: SDK disabled under `NODE_ENV=test` | Execute | Verified |
| OBS-10 | P3: Prometheus datasource provisioned with fixed UID, default | Execute | Verified |
| OBS-11 | P3: Dashboard auto-provisioned in a `Tatame` folder | Execute | Verified |
| OBS-12 | P3: All panels render real data against verified metric names | Execute | Verified |
| OBS-13 | P4: `docs/observability.md` explains the path, ports and verification curls | Execute | Verified |

**Coverage:** 13 total, 13 mapped to tasks, 13 verified ✅

---

## Success Criteria

- [ ] From a clean checkout: `docker compose ... up -d` + `pnpm api:dev` + a few requests →
      dashboard shows live data in under 60 seconds
- [x] Zero changes to any route handler, service or repository file
- [x] `pnpm --filter @tatame/api test` (304 passed) and `pnpm --filter @tatame/api lint` pass
      (`@tatame/web#lint` fails on a pre-existing unconfigured `next lint`, untouched here)
- [x] Every panel query was validated against `localhost:8889/metrics` output, not assumed
