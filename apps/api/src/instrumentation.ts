import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { RedisInstrumentation } from "@opentelemetry/instrumentation-redis-4";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_NAME
} from "@opentelemetry/semantic-conventions";
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from '@opentelemetry/semantic-conventions/incubating';

const collectorUrl = process.env.OTEL_COLLECTOR_URL;

if (collectorUrl) {
  console.log(`[otel] initializing SDK, exporting to ${collectorUrl}`);

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "tatame-api",
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV ?? "development",
    }),
    traceExporter: new OTLPTraceExporter({ url: collectorUrl }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: collectorUrl }),
      exportIntervalMillis: 30_000,
    }),
    logRecordProcessor: new BatchLogRecordProcessor(
      new OTLPLogExporter({ url: collectorUrl }),
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
  console.log("[otel] SDK started");

  const shutdown = async () => {
    await sdk.shutdown();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
} else {
  console.log("[otel] OTEL_COLLECTOR_URL not set, skipping SDK init");
}
