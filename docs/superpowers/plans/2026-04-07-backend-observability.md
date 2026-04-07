# Backend Observability Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add metrics, distributed traces, and structured logs to the Tatame API using OpenTelemetry + Grafana Stack (Loki, Tempo, Prometheus, Grafana).

**Architecture:** OTel SDK auto-instruments the Node.js API and exports telemetry via OTLP gRPC to an OTel Collector. The Collector routes traces to Tempo, metrics to Prometheus, and logs to Loki. Grafana provides dashboards and alerting on port 4000.

**Tech Stack:** OpenTelemetry SDK (Node.js), Pino logger, OTel Collector, Grafana, Tempo, Prometheus, Loki, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-04-07-backend-observability-design.md`

---

### Task 1: Add Pino Logger

**Files:**
- Create: `apps/api/src/lib/logger.ts`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install Pino dependencies**

```bash
cd apps/api && pnpm add pino pino-pretty
```

- [ ] **Step 2: Create the logger module**

Create `apps/api/src/lib/logger.ts`:

```typescript
import pino from "pino";
import { loadEnv } from "@tatame/config";

const env = loadEnv();

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : "info",
  ...(env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  }),
});
```

Note: In Task 3 we will add the OTel transport for production. For now, Pino outputs JSON to stdout in production and pretty-prints in dev.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/logger.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api): add Pino structured logger"
```

---

### Task 2: Replace All console.log/error/warn With Logger

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/migrate.ts`
- Modify: `apps/api/src/lib/redis.ts`
- Modify: `apps/api/src/modules/email/email.worker.ts`
- Modify: `apps/api/src/modules/manager-subscription/manager-subscription.routes.ts`
- Modify: `apps/api/src/modules/user/user.routes.ts`
- Modify: `apps/api/src/middleware/error-handler.ts`

- [ ] **Step 1: Update `server.ts`**

Add import at top:
```typescript
import { logger } from "./lib/logger.js";
```

Replace all console calls:
```typescript
// console.log("Running database migrations...") →
logger.info("Running database migrations...");

// console.log("[email] Worker started") →
logger.info("[email] Worker started");

// console.warn("[bull-board] BULL_BOARD_USER/BULL_BOARD_PASS not set — dashboard disabled") →
logger.warn("[bull-board] BULL_BOARD_USER/BULL_BOARD_PASS not set — dashboard disabled");

// console.log("[bull-board] Dashboard at /admin/queues") →
logger.info("[bull-board] Dashboard at /admin/queues");

// console.log(`API listening on http://localhost:${env.API_PORT}/v1`) →
logger.info({ port: env.API_PORT }, "API listening");

// console.log("Shutting down...") →
logger.info("Shutting down...");
```

- [ ] **Step 2: Update `migrate.ts`**

Add import at top:
```typescript
import { logger } from "./lib/logger.js";
```

Replace:
```typescript
// console.log("Migrations completed successfully") →
logger.info("Migrations completed successfully");
```

- [ ] **Step 3: Update `lib/redis.ts`**

Add import at top:
```typescript
import { logger } from "./logger.js";
```

Replace:
```typescript
// console.error("[redis]", msg) →
logger.error({ err: msg }, "[redis] connection error");
```

- [ ] **Step 4: Update `modules/email/email.worker.ts`**

Add import at top:
```typescript
import { logger } from "../../lib/logger.js";
```

Replace all console calls:
```typescript
// console.log(`[email] RESEND_API_KEY not set, skipping job ${job.name}:${job.id}`) →
logger.info({ jobName: job.name, jobId: job.id }, "[email] RESEND_API_KEY not set, skipping job");

// console.error(`[email] Unknown job name: ${jobName}`) →
logger.error({ jobName }, "[email] Unknown job name");

// console.error(`[email] Job ${job?.name}:${job?.id} failed:`, err.message) →
logger.error({ jobName: job?.name, jobId: job?.id, err: err.message }, "[email] Job failed");
```

- [ ] **Step 5: Update `modules/manager-subscription/manager-subscription.routes.ts`**

Add import at top:
```typescript
import { logger } from "../../lib/logger.js";
```

Replace:
```typescript
// console.warn("[manager-subscriptions/pro/complete] missing payment intent", { ... }) →
logger.warn({ ...contextObject }, "[manager-subscriptions/pro/complete] missing payment intent");
```

(Keep the existing context object as-is, just change `console.warn` → `logger.warn`.)

- [ ] **Step 6: Update `modules/user/user.routes.ts`**

Add import at top:
```typescript
import { logger } from "../../lib/logger.js";
```

Replace:
```typescript
// console.error("Failed to delete Clerk user:", clerkErr) →
logger.error({ err: clerkErr }, "Failed to delete Clerk user");
```

- [ ] **Step 7: Update `middleware/error-handler.ts`**

Add import at top:
```typescript
import { logger } from "../lib/logger.js";
```

Add logging for 500 errors (unhandled). Before the `res.status(500)` line:
```typescript
  logger.error({ err }, "Unhandled error");
  const message = err instanceof Error ? err.message : "Internal Server Error";
  res.status(500).json({ error: message });
```

- [ ] **Step 8: Run tests to verify nothing broke**

```bash
cd apps/api && pnpm test:unit
```

Expected: All existing tests pass.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/server.ts apps/api/src/migrate.ts apps/api/src/lib/redis.ts apps/api/src/modules/email/email.worker.ts apps/api/src/modules/manager-subscription/manager-subscription.routes.ts apps/api/src/modules/user/user.routes.ts apps/api/src/middleware/error-handler.ts
git commit -m "refactor(api): replace console.log/error with Pino logger"
```

---

### Task 3: Add OpenTelemetry SDK Instrumentation

**Files:**
- Create: `apps/api/src/instrumentation.ts`
- Modify: `apps/api/package.json`
- Modify: `packages/config/src/env.ts`
- Modify: `apps/api/src/lib/logger.ts`

- [ ] **Step 1: Add `OTEL_COLLECTOR_URL` env var**

In `packages/config/src/env.ts`, add to the `envSchema` object:

```typescript
  OTEL_COLLECTOR_URL: z.string().url().optional(),
```

- [ ] **Step 2: Install OTel dependencies**

```bash
cd apps/api && pnpm add \
  @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/sdk-trace-node \
  @opentelemetry/sdk-metrics \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/exporter-trace-otlp-grpc \
  @opentelemetry/exporter-metrics-otlp-grpc \
  @opentelemetry/exporter-logs-otlp-grpc \
  @opentelemetry/instrumentation-http \
  @opentelemetry/instrumentation-express \
  @opentelemetry/instrumentation-pg \
  @opentelemetry/instrumentation-redis-4 \
  @opentelemetry/instrumentation-undici \
  pino-opentelemetry-transport
```

- [ ] **Step 3: Create `instrumentation.ts`**

Create `apps/api/src/instrumentation.ts`:

```typescript
import { loadEnv } from "@tatame/config";

const env = loadEnv();

if (env.OTEL_COLLECTOR_URL) {
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { Resource } = await import("@opentelemetry/resources");
  const {
    ATTR_SERVICE_NAME,
    ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  } = await import("@opentelemetry/semantic-conventions");
  const { OTLPTraceExporter } = await import(
    "@opentelemetry/exporter-trace-otlp-grpc"
  );
  const { OTLPMetricExporter } = await import(
    "@opentelemetry/exporter-metrics-otlp-grpc"
  );
  const { OTLPLogExporter } = await import(
    "@opentelemetry/exporter-logs-otlp-grpc"
  );
  const { PeriodicExportingMetricReader } = await import(
    "@opentelemetry/sdk-metrics"
  );
  const { BatchLogRecordProcessor } = await import(
    "@opentelemetry/sdk-logs"
  );
  const { HttpInstrumentation } = await import(
    "@opentelemetry/instrumentation-http"
  );
  const { ExpressInstrumentation } = await import(
    "@opentelemetry/instrumentation-express"
  );
  const { PgInstrumentation } = await import(
    "@opentelemetry/instrumentation-pg"
  );
  const { RedisInstrumentation } = await import(
    "@opentelemetry/instrumentation-redis-4"
  );
  const { UndiciInstrumentation } = await import(
    "@opentelemetry/instrumentation-undici"
  );

  const collectorUrl = env.OTEL_COLLECTOR_URL;

  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: "tatame-api",
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: env.NODE_ENV,
    }),
    traceExporter: new OTLPTraceExporter({ url: `${collectorUrl}` }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${collectorUrl}` }),
      exportIntervalMillis: 30_000,
    }),
    logRecordProcessor: new BatchLogRecordProcessor(
      new OTLPLogExporter({ url: `${collectorUrl}` }),
    ),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new PgInstrumentation(),
      new RedisInstrumentation(),
      new UndiciInstrumentation(),
    ],
  });

  sdk.start();

  const shutdown = async () => {
    await sdk.shutdown();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
```

When `OTEL_COLLECTOR_URL` is not set, nothing is imported or started — zero overhead.

- [ ] **Step 4: Update logger to include OTel transport in production**

Update `apps/api/src/lib/logger.ts`:

```typescript
import pino from "pino";
import type { TransportTargetOptions } from "pino";
import { loadEnv } from "@tatame/config";

const env = loadEnv();

function buildTransport(): pino.TransportSingleOptions | pino.TransportMultiOptions | undefined {
  if (env.NODE_ENV === "test") return undefined;

  const targets: TransportTargetOptions[] = [];

  if (env.NODE_ENV !== "production") {
    targets.push({
      target: "pino-pretty",
      options: { colorize: true },
      level: "info",
    });
  } else {
    // stdout JSON in production
    targets.push({
      target: "pino/file",
      options: {},
      level: "info",
    });
  }

  if (env.OTEL_COLLECTOR_URL) {
    targets.push({
      target: "pino-opentelemetry-transport",
      options: {
        resourceAttributes: {
          "service.name": "tatame-api",
          "deployment.environment": env.NODE_ENV,
        },
      },
      level: "info",
    });
  }

  if (targets.length === 0) return undefined;
  if (targets.length === 1) return targets[0];
  return { targets };
}

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : "info",
  transport: buildTransport(),
});
```

- [ ] **Step 5: Wire instrumentation into server startup**

In `apps/api/src/server.ts`, add as the very first line (before all other imports):

```typescript
import "./instrumentation.js";
```

This must be the first import so OTel can patch modules before they are loaded.

- [ ] **Step 6: Run tests to verify nothing broke**

```bash
cd apps/api && pnpm test:unit
```

Expected: All existing tests pass. OTel is not started in tests because `OTEL_COLLECTOR_URL` is not set.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/instrumentation.ts apps/api/src/lib/logger.ts apps/api/src/server.ts apps/api/package.json packages/config/src/env.ts pnpm-lock.yaml
git commit -m "feat(api): add OpenTelemetry SDK instrumentation and Pino OTel transport"
```

---

### Task 4: Update Dockerfile

**Files:**
- Modify: `Dockerfile.api`

- [ ] **Step 1: Add `@opentelemetry/sdk-logs` dependency**

This package is needed at runtime but may be pulled in transitively. Verify it's in the lockfile after Task 3's install. If not:

```bash
cd apps/api && pnpm add @opentelemetry/sdk-logs
```

- [ ] **Step 2: Update Dockerfile.api CMD**

No changes needed. The instrumentation is imported directly in `server.ts` (via `import "./instrumentation.js"`), so it works with the existing `CMD ["node", "dist/server.js"]`.

- [ ] **Step 3: Commit (if any changes)**

```bash
git add Dockerfile.api
git commit -m "chore(docker): update API Dockerfile for OTel support"
```

Skip this commit if no Dockerfile changes were needed.

---

### Task 5: OTel Collector Configuration

**Files:**
- Create: `infra/observability/otel-collector-config.yml`

- [ ] **Step 1: Create the config directory**

```bash
mkdir -p infra/observability
```

- [ ] **Step 2: Create `otel-collector-config.yml`**

Create `infra/observability/otel-collector-config.yml`:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 5s
    send_batch_size: 1024
  memory_limiter:
    check_interval: 1s
    limit_mib: 128
    spike_limit_mib: 32
  attributes/scrub:
    actions:
      - key: http.request.header.authorization
        action: delete
      - key: http.request.header.cookie
        action: delete
      - key: db.statement
        action: hash

exporters:
  otlphttp/tempo:
    endpoint: http://tempo:4318
  prometheusremotewrite:
    endpoint: http://prometheus:9090/api/v1/write
  loki:
    endpoint: http://loki:3100/loki/api/v1/push

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, attributes/scrub, batch]
      exporters: [otlphttp/tempo]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [prometheusremotewrite]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, attributes/scrub, batch]
      exporters: [loki]
```

- [ ] **Step 3: Commit**

```bash
git add infra/observability/otel-collector-config.yml
git commit -m "feat(infra): add OTel Collector configuration"
```

---

### Task 6: Tempo Configuration

**Files:**
- Create: `infra/observability/tempo.yml`

- [ ] **Step 1: Create `tempo.yml`**

Create `infra/observability/tempo.yml`:

```yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        http:
          endpoint: 0.0.0.0:4318

storage:
  trace:
    backend: local
    local:
      path: /var/tempo/traces
    wal:
      path: /var/tempo/wal

compactor:
  compaction:
    block_retention: 168h  # 7 days

metrics_generator:
  registry:
    external_labels:
      source: tempo
  storage:
    path: /var/tempo/generator/wal
    remote_write:
      - url: http://prometheus:9090/api/v1/write
        send_exemplars: true

overrides:
  defaults:
    metrics_generator:
      processors: [service-graphs, span-metrics]
```

- [ ] **Step 2: Commit**

```bash
git add infra/observability/tempo.yml
git commit -m "feat(infra): add Tempo trace storage configuration"
```

---

### Task 7: Prometheus Configuration

**Files:**
- Create: `infra/observability/prometheus.yml`

- [ ] **Step 1: Create `prometheus.yml`**

Create `infra/observability/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

storage:
  tsdb:
    retention.time: 7d

remote_write: []

scrape_configs:
  - job_name: "otel-collector"
    static_configs:
      - targets: ["otel-collector:8889"]

  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]
```

Note: The OTel Collector exposes a Prometheus metrics endpoint on port 8889 by default when using the `prometheusremotewrite` exporter. We also need to enable the `--web.enable-remote-write-receiver` flag on Prometheus (done in docker-compose).

- [ ] **Step 2: Commit**

```bash
git add infra/observability/prometheus.yml
git commit -m "feat(infra): add Prometheus metrics configuration"
```

---

### Task 8: Loki Configuration

**Files:**
- Create: `infra/observability/loki.yml`

- [ ] **Step 1: Create `loki.yml`**

Create `infra/observability/loki.yml`:

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: "2024-01-01"
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

limits_config:
  retention_period: 168h  # 7 days
  allow_structured_metadata: true

compactor:
  working_directory: /loki/compactor
  compaction_interval: 10m
  retention_enabled: true
  delete_request_cancel_period: 10m
```

- [ ] **Step 2: Commit**

```bash
git add infra/observability/loki.yml
git commit -m "feat(infra): add Loki log storage configuration"
```

---

### Task 9: Grafana Provisioning (Datasources)

**Files:**
- Create: `infra/observability/grafana/provisioning/datasources/datasources.yml`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p infra/observability/grafana/provisioning/datasources
```

- [ ] **Step 2: Create `datasources.yml`**

Create `infra/observability/grafana/provisioning/datasources/datasources.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false

  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
    editable: false
    jsonData:
      tracesToLogsV2:
        datasourceUid: loki
        filterByTraceID: true
      tracesToMetrics:
        datasourceUid: prometheus
      serviceMap:
        datasourceUid: prometheus

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: false
    uid: loki
    jsonData:
      derivedFields:
        - name: TraceID
          datasourceUid: tempo
          matcherRegex: "trace_id=(\\w+)"
          url: "$${__value.raw}"
```

This auto-provisions all three datasources with cross-linking (logs → traces, traces → logs, traces → metrics).

- [ ] **Step 3: Commit**

```bash
git add infra/observability/grafana/
git commit -m "feat(infra): add Grafana datasource provisioning"
```

---

### Task 10: Grafana Dashboard Provisioning

**Files:**
- Create: `infra/observability/grafana/provisioning/dashboards/dashboards.yml`
- Create: `infra/observability/grafana/provisioning/dashboards/tatame-api-overview.json`

- [ ] **Step 1: Create dashboard provisioning config**

Create `infra/observability/grafana/provisioning/dashboards/dashboards.yml`:

```yaml
apiVersion: 1

providers:
  - name: default
    orgId: 1
    folder: ""
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /etc/grafana/provisioning/dashboards
      foldersFromFilesStructure: false
```

- [ ] **Step 2: Create the API overview dashboard JSON**

Create `infra/observability/grafana/provisioning/dashboards/tatame-api-overview.json`:

```json
{
  "annotations": { "list": [] },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 1,
  "links": [],
  "panels": [
    {
      "title": "Request Rate (req/s)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "expr": "sum(rate(http_server_request_duration_seconds_count[5m])) by (http_route)",
          "legendFormat": "{{http_route}}"
        }
      ],
      "fieldConfig": {
        "defaults": { "unit": "reqps" },
        "overrides": []
      }
    },
    {
      "title": "Error Rate (5xx %)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "expr": "sum(rate(http_server_request_duration_seconds_count{http_response_status_code=~\"5..\"}[5m])) / sum(rate(http_server_request_duration_seconds_count[5m])) * 100",
          "legendFormat": "5xx %"
        }
      ],
      "fieldConfig": {
        "defaults": { "unit": "percent", "max": 100 },
        "overrides": []
      }
    },
    {
      "title": "Latency p50 / p95 / p99",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "expr": "histogram_quantile(0.50, sum(rate(http_server_request_duration_seconds_bucket[5m])) by (le))",
          "legendFormat": "p50"
        },
        {
          "expr": "histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket[5m])) by (le))",
          "legendFormat": "p95"
        },
        {
          "expr": "histogram_quantile(0.99, sum(rate(http_server_request_duration_seconds_bucket[5m])) by (le))",
          "legendFormat": "p99"
        }
      ],
      "fieldConfig": {
        "defaults": { "unit": "s" },
        "overrides": []
      }
    },
    {
      "title": "Top Errors by Route",
      "type": "table",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "expr": "topk(10, sum by (http_route) (increase(http_server_request_duration_seconds_count{http_response_status_code=~\"5..\"}[1h])))",
          "format": "table",
          "instant": true
        }
      ]
    },
    {
      "title": "Recent Error Traces",
      "type": "table",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 16 },
      "datasource": { "type": "tempo" },
      "targets": [
        {
          "queryType": "traceqlSearch",
          "filters": [
            { "id": "status", "tag": "status", "operator": "=", "value": ["error"] },
            { "id": "service-name", "tag": "service.name", "operator": "=", "value": ["tatame-api"] }
          ],
          "limit": 20
        }
      ]
    },
    {
      "title": "Error Logs (Live)",
      "type": "logs",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 16 },
      "datasource": { "type": "loki", "uid": "loki" },
      "targets": [
        {
          "expr": "{service_name=\"tatame-api\"} | json | level = \"error\"",
          "refId": "A"
        }
      ]
    }
  ],
  "schemaVersion": 39,
  "tags": ["tatame", "api"],
  "templating": {
    "list": [
      {
        "name": "DS_PROMETHEUS",
        "type": "datasource",
        "query": "prometheus",
        "current": { "text": "Prometheus", "value": "Prometheus" }
      }
    ]
  },
  "time": { "from": "now-1h", "to": "now" },
  "title": "Tatame API Overview",
  "uid": "tatame-api-overview"
}
```

- [ ] **Step 3: Commit**

```bash
git add infra/observability/grafana/provisioning/dashboards/
git commit -m "feat(infra): add Grafana dashboard provisioning with API overview"
```

---

### Task 11: Grafana Alert Rules

**Files:**
- Create: `infra/observability/grafana/provisioning/alerting/alerts.yml`

- [ ] **Step 1: Create alerting directory**

```bash
mkdir -p infra/observability/grafana/provisioning/alerting
```

- [ ] **Step 2: Create `alerts.yml`**

Create `infra/observability/grafana/provisioning/alerting/alerts.yml`:

```yaml
apiVersion: 1

groups:
  - orgId: 1
    name: tatame-api-alerts
    folder: Tatame
    interval: 1m
    rules:
      - uid: high-error-rate
        title: "High Error Rate"
        condition: C
        data:
          - refId: A
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: Prometheus
            model:
              expr: >
                sum(rate(http_server_request_duration_seconds_count{http_response_status_code=~"5.."}[5m]))
                /
                sum(rate(http_server_request_duration_seconds_count[5m]))
                * 100
              instant: true
          - refId: C
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: __expr__
            model:
              type: threshold
              conditions:
                - evaluator:
                    type: gt
                    params: [5]
                  operator:
                    type: and
                  query:
                    params: [A]
        for: 5m
        annotations:
          summary: "Error rate above 5% for 5 minutes"
        labels:
          severity: critical

      - uid: high-latency-p95
        title: "High Latency (p95)"
        condition: C
        data:
          - refId: A
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: Prometheus
            model:
              expr: >
                histogram_quantile(0.95,
                  sum(rate(http_server_request_duration_seconds_bucket[5m])) by (le)
                )
              instant: true
          - refId: C
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: __expr__
            model:
              type: threshold
              conditions:
                - evaluator:
                    type: gt
                    params: [2]
                  operator:
                    type: and
                  query:
                    params: [A]
        for: 5m
        annotations:
          summary: "API p95 latency above 2s for 5 minutes"
        labels:
          severity: warning

      - uid: service-down
        title: "Service Down"
        condition: C
        data:
          - refId: A
            relativeTimeRange:
              from: 60
              to: 0
            datasourceUid: Prometheus
            model:
              expr: "up{job=\"otel-collector\"}"
              instant: true
          - refId: C
            relativeTimeRange:
              from: 60
              to: 0
            datasourceUid: __expr__
            model:
              type: threshold
              conditions:
                - evaluator:
                    type: lt
                    params: [1]
                  operator:
                    type: and
                  query:
                    params: [A]
        for: 1m
        annotations:
          summary: "API service appears down (no metrics received for 1 minute)"
        labels:
          severity: critical
```

- [ ] **Step 3: Commit**

```bash
git add infra/observability/grafana/provisioning/alerting/
git commit -m "feat(infra): add Grafana alert rules (error rate, latency, service down)"
```

---

### Task 12: Docker Compose Observability Stack

**Files:**
- Create: `docker-compose.observability.yml`

- [ ] **Step 1: Create `docker-compose.observability.yml`**

Create `docker-compose.observability.yml` at project root:

```yaml
services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    command: ["--config", "/etc/otelcol/config.yml"]
    volumes:
      - ./infra/observability/otel-collector-config.yml:/etc/otelcol/config.yml:ro
    ports:
      - "4317:4317"  # OTLP gRPC
      - "4318:4318"  # OTLP HTTP
    networks:
      - observability
    restart: unless-stopped

  tempo:
    image: grafana/tempo:latest
    command: ["-config.file=/etc/tempo/tempo.yml"]
    volumes:
      - ./infra/observability/tempo.yml:/etc/tempo/tempo.yml:ro
      - tempo_data:/var/tempo
    networks:
      - observability
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
      - "--storage.tsdb.retention.time=7d"
      - "--web.enable-remote-write-receiver"
    volumes:
      - ./infra/observability/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    networks:
      - observability
    restart: unless-stopped

  loki:
    image: grafana/loki:latest
    command: ["-config.file=/etc/loki/loki.yml"]
    volumes:
      - ./infra/observability/loki.yml:/etc/loki/loki.yml:ro
      - loki_data:/loki
    networks:
      - observability
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-admin}
      - GF_SMTP_ENABLED=${GRAFANA_SMTP_HOST:+true}
      - GF_SMTP_HOST=${GRAFANA_SMTP_HOST:-}
      - GF_SMTP_USER=${GRAFANA_SMTP_USER:-}
      - GF_SMTP_PASSWORD=${GRAFANA_SMTP_PASSWORD:-}
      - GF_SMTP_FROM_ADDRESS=${GRAFANA_SMTP_FROM:-noreply@apptatame.com.br}
    volumes:
      - ./infra/observability/grafana/provisioning:/etc/grafana/provisioning:ro
      - grafana_data:/var/lib/grafana
    ports:
      - "4000:3000"
    networks:
      - observability
    depends_on:
      - prometheus
      - tempo
      - loki
    restart: unless-stopped

networks:
  observability:
    driver: bridge

volumes:
  tempo_data:
  prometheus_data:
  loki_data:
  grafana_data:
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.observability.yml
git commit -m "feat(infra): add docker-compose for observability stack"
```

---

### Task 13: Update .env.example and Documentation

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add observability env vars to `.env.example`**

Append to `.env.example`:

```bash

# ── Observability (optional) ──────────────────────────────────
# OTel Collector endpoint — set to enable traces, metrics, and log export
# OTEL_COLLECTOR_URL=http://localhost:4317

# Grafana admin password (default: admin)
# GRAFANA_ADMIN_PASSWORD=admin

# Grafana SMTP for alerts (optional)
# GRAFANA_SMTP_HOST=smtp.example.com:587
# GRAFANA_SMTP_USER=alerts@example.com
# GRAFANA_SMTP_PASSWORD=secret
# GRAFANA_SMTP_FROM=noreply@apptatame.com.br
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add observability env vars to .env.example"
```

---

### Task 14: End-to-End Smoke Test

- [ ] **Step 1: Start the observability stack locally**

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
```

- [ ] **Step 2: Start the API with OTel enabled**

```bash
OTEL_COLLECTOR_URL=http://localhost:4317 pnpm --filter @tatame/api dev
```

- [ ] **Step 3: Generate some traffic**

```bash
curl http://localhost:3001/v1/health
curl http://localhost:3001/v1/ready
curl http://localhost:3001/v1/nonexistent  # should 404
```

- [ ] **Step 4: Verify in Grafana**

Open `http://localhost:4000` (admin / admin).

Check:
- **Explore → Tempo:** Search for traces with `service.name = tatame-api`. Verify you see spans for the 3 requests above.
- **Explore → Loki:** Query `{service_name="tatame-api"}`. Verify structured logs appear.
- **Explore → Prometheus:** Query `http_server_request_duration_seconds_count`. Verify metrics are arriving.
- **Dashboards → Tatame API Overview:** Verify panels show data.

- [ ] **Step 5: Verify log↔trace correlation**

In Loki, find a log entry. It should have a `trace_id` field. Click it to navigate to the corresponding trace in Tempo.

- [ ] **Step 6: Stop everything**

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml down
```

- [ ] **Step 7: Run unit tests one final time**

```bash
cd apps/api && pnpm test:unit
```

Expected: All tests pass.
