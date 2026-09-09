/**
 * OpenTelemetry bootstrap — metrics, traces and logs.
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
import type { ServerResponse } from "node:http";
import { hostname } from "node:os";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_INSTANCE_ID,
  ATTR_SERVICE_NAMESPACE,
} from "@opentelemetry/semantic-conventions";
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from "@opentelemetry/semantic-conventions/incubating";
import { CAPTURED_ERROR, type CapturedError } from "./telemetry/error-capture.js";

const DEFAULT_EXPORT_INTERVAL_MS = 10_000;
const DEFAULT_SERVICE_NAME = "tatame-api";
const DEFAULT_SERVICE_NAMESPACE = "tatame";

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
  const serviceNamespace =
    process.env.OTEL_SERVICE_NAMESPACE ?? DEFAULT_SERVICE_NAMESPACE;
  // Traces ride the same collector URL as metrics, but can be switched off on
  // their own — they are far noisier, and one signal at a time is often what you
  // want while debugging.
  const tracesEnabled = process.env.OTEL_TRACES_ENABLED !== "false";
  // Same switch for logs. Note this is the *export* switch only: `logger.ts`
  // always writes to stdout, so turning this off costs visibility in Grafana,
  // never in the terminal.
  const logsEnabled = process.env.OTEL_LOGS_ENABLED !== "false";

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      // Groups every service of this product under one name. The APM dashboard
      // navigates namespace -> service, and its variable chain comes back empty
      // without this attribute. Also listed in the Collector's
      // `resource_constant_labels` so it lands on `target_info`.
      [ATTR_SERVICE_NAMESPACE]: serviceNamespace,
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
    // `traceExporter` makes the SDK wrap it in a BatchSpanProcessor. When traces
    // are off, `spanProcessors: []` is required rather than merely omitted:
    // without it the SDK falls back to `OTEL_TRACES_EXPORTER`, whose default is
    // OTLP, and it would ship spans to localhost:4318 and log export errors.
    ...(tracesEnabled
      ? { traceExporter: new OTLPTraceExporter({ url: collectorUrl }) }
      : { spanProcessors: [] }),
    // Registering a processor is what makes the SDK build a LoggerProvider and
    // publish it globally, which is the provider `telemetry/logger.ts` picks up
    // through `@opentelemetry/api-logs`. One provider, in this process — the
    // previous stack ran a second one inside a pino worker thread, which could
    // not see the active span and so emitted logs no trace could be linked to.
    //
    // `logRecordProcessors: []` when off, for exactly the reason `spanProcessors`
    // needs it. Omitting the key makes the SDK fall back to
    // `configureLoggerProviderFromEnv`, which treats an empty `OTEL_LOGS_EXPORTER`
    // as "otlp" over the default `http/protobuf` — i.e. it would quietly ship
    // logs to localhost:4318, which in this stack is the Collector's HTTP port.
    // Disabling logs would have kept exporting them. The empty array is truthy,
    // so it suppresses that fallback and leaves a provider with nowhere to send.
    logRecordProcessors: logsEnabled
      ? [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter({ url: collectorUrl }) })]
      : [],
    instrumentations: [
      getNodeAutoInstrumentations({
        // Every fs call becomes telemetry otherwise. Enormous volume, no value here.
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-http": {
          // Out of the box a failed request leaves only a status code on the
          // span — you learn that it was a 401, never why. This copies the
          // error envelope the app already wrote onto the server span, which is
          // the span you click on in Grafana.
          //
          // Span *status* is deliberately left alone: the instrumentation
          // already marks 5xx as ERROR and leaves 4xx unset, which is what the
          // HTTP semantic conventions ask for on a server span — a 4xx is the
          // caller's fault. Use `{span.error.type != nil}` to find those.
          //
          // `applyCustomAttributesOnSpan`, not `responseHook`: despite the
          // name, `responseHook` only runs on the outgoing/client path. The
          // incoming path calls this one, from `_onServerResponseFinish` —
          // after the response is written, so `res.json` has already stashed
          // the body.
          applyCustomAttributesOnSpan: (span, _request, response) => {
            // Also fires for client spans, where `response` is the
            // IncomingMessage of an outgoing call. Only a ServerResponse has
            // `setHeader`, and only a ServerResponse carries our capture.
            if (!("setHeader" in response)) return;
            const serverResponse = response as ServerResponse & {
              [CAPTURED_ERROR]?: CapturedError;
            };
            const status = serverResponse.statusCode;
            if (status < 400) return;

            const captured = serverResponse[CAPTURED_ERROR];
            span.setAttribute("error.type", captured?.code ?? String(status));
            if (captured?.body) span.setAttribute("app.error.body", captured.body);
            // Gives the trace a stack trace, as a span event.
            if (captured?.error) span.recordException(captured.error);
          },
        },
      }),
    ],
  });

  sdk.start();
  console.log(
    `[otel] metrics exporting to ${collectorUrl} every ${exportIntervalMillis}ms ` +
      `(service=${serviceNamespace}/${serviceName})`,
  );
  console.log(
    tracesEnabled
      ? `[otel] traces exporting to ${collectorUrl}`
      : "[otel] OTEL_TRACES_ENABLED=false — traces disabled",
  );
  console.log(
    logsEnabled
      ? `[otel] logs exporting to ${collectorUrl}`
      : "[otel] OTEL_LOGS_ENABLED=false — logs disabled (stdout unaffected)",
  );
}

/**
 * Flushes pending telemetry and stops the SDK. Safe to call when telemetry is off.
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
