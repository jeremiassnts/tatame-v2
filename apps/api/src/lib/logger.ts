import pino from "pino";
import type { TransportTargetOptions } from "pino";
import { loadEnv } from "@tatame/config";

const env = loadEnv();

function buildTransport():
  | pino.TransportSingleOptions
  | pino.TransportMultiOptions
  | undefined {
  if (env.NODE_ENV === "test") return undefined;

  const targets: TransportTargetOptions[] = [];

  if (env.NODE_ENV !== "production") {
    targets.push({
      target: "pino-pretty",
      options: { colorize: true },
      level: "info",
    });
  } else {
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
