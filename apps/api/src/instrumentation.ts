import { loadEnv } from "@tatame/config";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from "@opentelemetry/semantic-conventions";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { RedisInstrumentation } from "@opentelemetry/instrumentation-redis-4";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";

const env = loadEnv();

if (env.OTEL_COLLECTOR_URL) {
  const collectorUrl = env.OTEL_COLLECTOR_URL;

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: "tatame-api",
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: env.NODE_ENV,
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

  const shutdown = async () => {
    await sdk.shutdown();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
