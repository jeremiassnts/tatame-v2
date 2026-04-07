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
