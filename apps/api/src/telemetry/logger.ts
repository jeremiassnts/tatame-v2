/**
 * The one way anything in `apps/api` writes a log.
 *
 * Two sinks, always both: stdout, and the OpenTelemetry logs API. stdout is
 * unconditional — a developer running `pnpm api:dev` with the observability
 * stack down must still see their logs, so export is strictly additive.
 *
 * This module talks to `@opentelemetry/api-logs` and **never** to the SDK. The
 * provider it uses is whichever one `instrumentation.ts` registered globally;
 * when telemetry is off, the API hands back a no-op and the only cost is a
 * function call. That decoupling is why this file has no load-order constraints
 * and any module may import it.
 *
 * It is also the correction of a specific past failure. The previous stack
 * logged through pino with `pino-opentelemetry-transport`, and pino transports
 * run in a worker thread: the worker could not see the main thread's active
 * span, so it stood up a second LoggerProvider with its own resource and emitted
 * records that no trace could ever be linked to. Emitting here, on the main
 * thread, is what makes `trace_id` correlation work at all.
 */
import { SeverityNumber, logs } from "@opentelemetry/api-logs";
import type { AnyValue, LogAttributes } from "@opentelemetry/api-logs";
import { redact, serialize } from "./redact.js";

export type Level = "debug" | "info" | "warn" | "error";

export interface LogFields {
  [key: string]: unknown;
}

const SEVERITY: Record<Level, { number: SeverityNumber; text: string }> = {
  debug: { number: SeverityNumber.DEBUG, text: "DEBUG" },
  info: { number: SeverityNumber.INFO, text: "INFO" },
  warn: { number: SeverityNumber.WARN, text: "WARN" },
  error: { number: SeverityNumber.ERROR, text: "ERROR" },
};

const ORDER: Level[] = ["debug", "info", "warn", "error"];

/**
 * Read once, at load. `NODE_ENV=test` is silent by default so `vitest` output is
 * not buried under application logs; setting `LOG_LEVEL` explicitly overrides
 * that, which is how you debug a failing test.
 */
function configuredLevel(): Level | "silent" {
  const requested = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (requested && ORDER.includes(requested as Level)) return requested as Level;
  if (process.env.NODE_ENV === "test") return "silent";
  return "info";
}

const level = configuredLevel();
const threshold = level === "silent" ? Infinity : ORDER.indexOf(level);

/** A field bag big enough to matter is a mistake; cap it well above normal use. */
const MAX_FIELD_CHARS = 4096;

/**
 * OTel attributes are scalars, arrays and maps — not `Error`s, `Date`s or class
 * instances. Anything else is stringified through `serialize`, which redacts and
 * caps on the way.
 */
function toAttributeValue(value: unknown): AnyValue {
  if (value === null || value === undefined) return value;
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") {
    return value as AnyValue;
  }
  return serialize(value, MAX_FIELD_CHARS);
}

/** `err` is expanded into semconv exception attributes and removed as a field. */
function expandError(error: unknown): LogAttributes {
  if (error instanceof Error) {
    return {
      "exception.type": error.name,
      "exception.message": error.message,
      ...(error.stack ? { "exception.stacktrace": error.stack } : {}),
    };
  }
  return { "exception.message": serialize(error, MAX_FIELD_CHARS) };
}

function buildAttributes(fields: LogFields): LogAttributes {
  const { err, ...rest } = fields;
  const out: LogAttributes = {};
  // `redact` walks the whole bag once, so nested values are covered too.
  const safe = redact(rest) as Record<string, unknown>;
  for (const [key, value] of Object.entries(safe)) {
    out[key] = toAttributeValue(value);
  }
  if (err !== undefined) Object.assign(out, expandError(err));
  return out;
}

/**
 * Human-readable on a terminal, one JSON object per line everywhere else — which
 * is what a container log collector wants, and what stays greppable in CI.
 */
function writeStdout(lvl: Level, message: string, attributes: LogAttributes): void {
  if (process.stdout.isTTY) {
    const extra = Object.keys(attributes).length
      ? ` ${JSON.stringify(attributes)}`
      : "";
    process.stdout.write(`${lvl.toUpperCase().padEnd(5)} ${message}${extra}\n`);
    return;
  }
  process.stdout.write(
    `${JSON.stringify({
      time: new Date().toISOString(),
      level: lvl,
      message,
      ...attributes,
    })}\n`,
  );
}

function emit(lvl: Level, bound: LogFields, message: string, fields?: LogFields): void {
  // Everything below is wrapped: a broken log line must never fail the request
  // that produced it. There is nowhere useful to report a logging failure to —
  // reporting it would go through this same code — so it is dropped on purpose.
  try {
    if (ORDER.indexOf(lvl) < threshold) return;
    const attributes = buildAttributes({ ...bound, ...fields });
    writeStdout(lvl, message, attributes);
    // A record carrying an `event.name` attribute is, by definition, that
    // event — so populate the native field too. It is where the OTel semantic
    // conventions put the value; Loki happens to drop it on ingest, which is
    // why the attribute stays the thing queries filter on.
    const eventName = attributes["event.name"];
    logs.getLogger("tatame-api").emit({
      ...(typeof eventName === "string" ? { eventName } : {}),
      severityNumber: SEVERITY[lvl].number,
      severityText: SEVERITY[lvl].text,
      body: message,
      attributes,
    });
  } catch {
    // Deliberately empty.
  }
}

export interface Log {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  /** `fields.err` becomes `exception.type` / `.message` / `.stacktrace`. */
  error(message: string, fields?: LogFields & { err?: unknown }): void;
  /** Returns a logger that adds `fields` to every record. Call-site fields win. */
  child(fields: LogFields): Log;
}

function createLog(bound: LogFields): Log {
  return {
    debug: (message, fields) => emit("debug", bound, message, fields),
    info: (message, fields) => emit("info", bound, message, fields),
    warn: (message, fields) => emit("warn", bound, message, fields),
    error: (message, fields) => emit("error", bound, message, fields),
    child: (fields) => createLog({ ...bound, ...fields }),
  };
}

export const log: Log = createLog({});
