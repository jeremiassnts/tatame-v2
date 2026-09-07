/**
 * OpenTelemetry bootstrap — metrics only.
 *
 * Must be imported before `express`, `pg` and `redis` are loaded: the auto
 * instrumentations work by patching those modules as they are required, so
 * anything loaded earlier is invisible to them. See `server.ts`.
 *
 * Reads `process.env` directly rather than `loadEnv()` so a validation error in
 * an unrelated variable cannot fail the process from inside this module — and so
 * this file has no import that could pull in an instrumented library early.
 *
 * Nothing is exported to the app except `flushTelemetry()`; the SDK is started
 * as an import side effect.
 */
import { hostname } from "node:os";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_INSTANCE_ID,
} from "@opentelemetry/semantic-conventions";
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from "@opentelemetry/semantic-conventions/incubating";

const DEFAULT_EXPORT_INTERVAL_MS = 10_000;
const DEFAULT_SERVICE_NAME = "tatame-api";

const collectorUrl = process.env.OTEL_COLLECTOR_URL;
const nodeEnv = process.env.NODE_ENV ?? "development";

let sdk: NodeSDK | undefined;

if (!collectorUrl) {
  console.log("[otel] OTEL_COLLECTOR_URL not set — telemetry disabled");
} else if (nodeEnv === "test") {
  console.log("[otel] NODE_ENV=test — telemetry disabled");
} else {
  const exportIntervalMillis =
    Number(process.env.OTEL_METRIC_EXPORT_INTERVAL) || DEFAULT_EXPORT_INTERVAL_MS;
  const serviceName = process.env.OTEL_SERVICE_NAME ?? DEFAULT_SERVICE_NAME;

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      // Distinguishes several processes of the same service (e.g. `pnpm api:dev`
      // running next to a container) within the same Prometheus series.
      [ATTR_SERVICE_INSTANCE_ID]: `${hostname()}-${process.pid}`,
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: nodeEnv,
    }),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: collectorUrl }),
        exportIntervalMillis,
      }),
    ],
    // Explicitly empty: without this the SDK falls back to `OTEL_TRACES_EXPORTER`,
    // whose default is OTLP — it would ship spans to localhost:4318 and log export
    // errors. Traces are a separate, later iteration.
    spanProcessors: [],
    instrumentations: [
      getNodeAutoInstrumentations({
        // Every fs call becomes telemetry otherwise. Enormous volume, no value here.
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  sdk.start();
  console.log(
    `[otel] metrics exporting to ${collectorUrl} every ${exportIntervalMillis}ms (service=${serviceName})`,
  );
}

/**
 * Flushes pending metrics and stops the SDK. Safe to call when telemetry is off.
 * Called from the API's graceful shutdown before `process.exit`, so the last
 * export window is not lost.
 */
export async function flushTelemetry(): Promise<void> {
  if (!sdk) return;
  try {
    await sdk.shutdown();
    console.log("[otel] telemetry flushed");
  } catch (error) {
    console.error("[otel] failed to flush telemetry", error);
  }
}
