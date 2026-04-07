# Backend Observability Stack — Design Spec

**Linear:** TAT-56
**Date:** 2026-04-07
**Status:** Approved

## Overview

Implement a full observability stack for the Tatame API covering metrics, distributed traces, and structured logs. Self-hosted on the existing Coolify VPS using the Grafana Stack (LGTM) with OpenTelemetry for instrumentation.

## Architecture

```
┌─────────────────────────────────────┐
│           VPS (Coolify)             │
│                                     │
│  ┌──────────┐    OTLP/gRPC (4317)  │
│  │ API Node │──────────────────┐    │
│  │ (OTel SDK│                  │    │
│  │ + Pino)  │                  ▼    │
│  └──────────┘          ┌────────────┐
│                        │ OTel       │
│                        │ Collector  │
│                        └─────┬──┬──┬┘
│                   traces│metrics│ │logs
│                         ▼      ▼  ▼    │
│                    ┌─────┐ ┌────┐ ┌────┐
│                    │Tempo│ │Prom│ │Loki│
│                    └──┬──┘ └─┬──┘ └─┬──┘
│                       │      │      │   │
│                       ▼      ▼      ▼   │
│                    ┌────────────────────┐│
│                    │  Grafana (:4000)   ││
│                    │ (dashboards+alerts)││
│                    └────────────────────┘│
└─────────────────────────────────────────┘
```

## VPS Constraints

- 2 CPU cores, 8GB RAM total
- Already running: Postgres, Redis, API, Web
- Estimated observability overhead: ~1.7GB RAM

## Components

### 1. OpenTelemetry SDK (Instrumentation)

File: `apps/api/src/instrumentation.ts`, loaded via `NODE_OPTIONS="--import ./dist/instrumentation.js"`.

**Auto-instrumentation packages:**

| Package | Purpose |
|---------|---------|
| `@opentelemetry/instrumentation-http` | Traces for inbound/outbound HTTP requests |
| `@opentelemetry/instrumentation-express` | Spans per middleware/route |
| `@opentelemetry/instrumentation-pg` | Postgres query traces (drizzle uses `postgres` driver) |
| `@opentelemetry/instrumentation-redis-4` | Redis command traces |
| `@opentelemetry/instrumentation-undici` | Outbound HTTP (Clerk, Stripe, Resend use fetch/undici) |

**Exporters:** OTLP gRPC to OTel Collector at port 4317 (traces + metrics).

**Resource attributes:** `service.name=tatame-api`, `deployment.environment` from `NODE_ENV`.

### 2. Pino (Structured Logging)

File: `apps/api/src/lib/logger.ts`

- Replace all `console.log`/`console.error` with Pino logger instance
- `pino-opentelemetry-transport` sends logs to OTel Collector via OTLP
- Auto-injects `trace_id` and `span_id` for log↔trace correlation in Grafana
- Dev mode: `pino-pretty` for readable terminal output

### 3. OTel Collector

Image: `otel/opentelemetry-collector-contrib`
Config: `infra/observability/otel-collector-config.yml`

- **Receivers:** OTLP gRPC (4317), OTLP HTTP (4318)
- **Processors:** batch, memory_limiter, attributes (PII scrubbing for tokens/secrets)
- **Exporters:** Tempo (traces), Prometheus remote write (metrics), Loki (logs)

### 4. Tempo (Traces)

Image: `grafana/tempo`
Config: `infra/observability/tempo.yml`

- Local filesystem storage
- Retention: 7 days

### 5. Prometheus (Metrics)

Image: `prom/prometheus`
Config: `infra/observability/prometheus.yml`

- Scrapes OTel Collector metrics endpoint
- Retention: 7 days

### 6. Loki (Logs)

Image: `grafana/loki`
Config: `infra/observability/loki.yml`

- Local filesystem storage
- Retention: 7 days

### 7. Grafana (Dashboards + Alerts)

Image: `grafana/grafana`
Port: 4000

- Auto-provisioned datasources: Tempo, Prometheus, Loki
- Admin password configurable via env var

## Docker Compose

File: `docker-compose.observability.yml` at project root.

| Service | Image | Est. RAM | Ports |
|---------|-------|----------|-------|
| otel-collector | `otel/opentelemetry-collector-contrib` | ~200MB | 4317, 4318 |
| tempo | `grafana/tempo` | ~300MB | 3200 (internal) |
| prometheus | `prom/prometheus` | ~500MB | 9090 (internal) |
| loki | `grafana/loki` | ~400MB | 3100 (internal) |
| grafana | `grafana/grafana` | ~300MB | 4000 |

Network: `observability` (shared with API container).

Configuration files stored in `infra/observability/`.

## Dashboard — "Tatame API Overview"

Panels:
- **Request rate** — requests/sec by route (timeseries)
- **Error rate** — percentage of 5xx by route (timeseries)
- **Latency p50/p95/p99** — by route (timeseries)
- **Top errors** — table of routes with most errors
- **Recent error traces** — list of traces with ERROR status, links to full trace
- **Logs stream** — latest error logs in real-time (Loki query)

## Alerts

| Alert | Condition | Channel |
|-------|-----------|---------|
| High error rate | 5xx > 5% for 5 minutes | Email |
| High latency | p95 > 2s for 5 minutes | Email |
| Service down | Health check no response for 1 minute | Email |

Notification channel: Email via SMTP. Webhook (Slack/Discord) can be added later.

## Code Changes

### New files

- `apps/api/src/instrumentation.ts` — OTel SDK setup with auto-instrumentations
- `apps/api/src/lib/logger.ts` — Pino instance with OTel transport
- `infra/observability/` — all service configs + docker-compose
- `infra/observability/grafana/provisioning/` — datasources + dashboard JSON

### Modified files

- `apps/api/package.json` — OTel + Pino dependencies
- `packages/config/src/env.ts` — new `OTEL_COLLECTOR_URL` env var (default `http://localhost:4317`)
- `Dockerfile.api` — add `NODE_OPTIONS="--import ./dist/instrumentation.js"` to CMD
- `apps/api/src/server.ts` — replace console.log/error with logger
- `apps/api/src/lib/redis.ts` — replace console.error with logger
- `apps/api/src/modules/email/email.worker.ts` — replace console with logger
- `apps/api/src/middleware/error-handler.ts` — replace console.error with logger
- Other files with console.log/error — replace with logger

### No changes to

- Business logic, routes, or schemas
- Database migrations
- Mobile or web apps

## Dev Local

- `OTEL_COLLECTOR_URL` not set → OTel SDK disabled (noop exporter), zero overhead
- Pino uses `pino-pretty` in development (`NODE_ENV !== 'production'`)
- `docker-compose.observability.yml` can be run locally to test dashboards (optional)
- No extra dependencies required for `pnpm dev`

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OTEL_COLLECTOR_URL` | No | `http://localhost:4317` | OTel Collector gRPC endpoint |
| `GRAFANA_ADMIN_PASSWORD` | No | `admin` | Grafana admin password |
| `GRAFANA_SMTP_HOST` | No | — | SMTP host for alert emails |
| `GRAFANA_SMTP_USER` | No | — | SMTP user |
| `GRAFANA_SMTP_PASSWORD` | No | — | SMTP password |
| `GRAFANA_SMTP_FROM` | No | — | From address for alerts |
