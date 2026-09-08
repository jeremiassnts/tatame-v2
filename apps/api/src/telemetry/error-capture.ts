/**
 * Captures the body of error responses so it can be attached to the HTTP server
 * span. Nothing else — no request bodies, no successful responses.
 *
 * Why a middleware plus a hook rather than just reading the error in
 * `errorHandler`: most error responses in this app never reach `errorHandler`.
 * `requireSession` writes its own 401, `validateBody` its own 400,
 * `express-rate-limit` its own 429 — each by calling `res.json` directly.
 * Wrapping `res.json` once catches every one of them.
 *
 * The capture is stashed on the response object instead of being returned,
 * because the consumer is `responseHook` in `instrumentation.ts`. That hook is
 * handed the `ServerResponse` *and* the server span — the span you click on in
 * Grafana. Setting the attributes from inside this middleware would put them on
 * the surrounding `middleware - ...` child span instead, which is not where
 * anyone looks.
 *
 * This module is imported by `instrumentation.ts`, which loads before Express.
 * It must therefore stay free of runtime imports: the `express` import below is
 * type-only and disappears at compile time. Do not add a value import here.
 */
import type { NextFunction, Request, Response } from "express";

/**
 * Registered under `Symbol.for` so the key is the same object across module
 * instances — `instrumentation.ts` is loaded through a different path than the
 * app, and a plain `Symbol()` would not match.
 */
export const CAPTURED_ERROR = Symbol.for("tatame.otel.capturedError");

export interface CapturedError {
  /** Low-cardinality application error code, when the envelope carries one. */
  code?: string;
  /** The response body, redacted and truncated. */
  body: string;
  /** Only set for errors that reached `errorHandler` — carries the stack. */
  error?: Error;
}

type Carrier = { [CAPTURED_ERROR]?: CapturedError };

/**
 * Traces are not a place to store payloads. This is enough for an error
 * envelope — `{ error, message }`, or a flattened Zod issue list — and well
 * short of the point where span size starts to matter.
 */
const MAX_BODY_CHARS = 2048;

/** Depth guard: an error envelope is shallow, and cycles must not hang the walk. */
const MAX_DEPTH = 6;

/**
 * Words long and unambiguous enough to match anywhere in a key. `userPassword`
 * and `x-authorization-header` both need to be caught however they are spelled.
 */
const SENSITIVE_FRAGMENTS = [
  "password",
  "passwd",
  "passphrase",
  "secret",
  "token",
  "authorization",
  "cookie",
  "credential",
  "signature",
];

/**
 * Words too short to match as substrings — `key` would redact `monkey`, `pin`
 * would redact `pinned`. These are compared against whole name segments, so
 * `apiKey` and `api_key` are caught while `monkey` is left alone.
 */
const SENSITIVE_SEGMENTS = new Set([
  "key",
  "keys",
  "auth",
  "pass",
  "pin",
  "otp",
  "sig",
  "jwt",
  "bearer",
  "salt",
  "hash",
]);

/** `apiKey` -> ["api","key"], `access_token` -> ["access","token"]. */
function segments(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_\-.]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());
}

function isSensitive(key: string): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_FRAGMENTS.some((fragment) => lower.includes(fragment))) return true;
  return segments(key).some((segment) => SENSITIVE_SEGMENTS.has(segment));
}

function redact(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEPTH) return "[max depth]";
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value === null || typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitive(key) ? "[redacted]" : redact(nested, depth + 1);
  }
  return out;
}

function serialize(body: unknown): string {
  let text: string;
  try {
    text = typeof body === "string" ? body : (JSON.stringify(redact(body)) ?? "");
  } catch {
    // Cycles are already handled by the depth guard in `redact`; what reaches
    // here is a value JSON cannot express at all, such as a BigInt. The status
    // code and route are on the span regardless, so a marker beats losing the
    // whole attribute.
    return "[unserializable]";
  }
  return text.length > MAX_BODY_CHARS
    ? `${text.slice(0, MAX_BODY_CHARS)}…[truncated]`
    : text;
}

/**
 * `error.type` becomes a span dimension, so it has to stay low cardinality.
 * The `error` field of this API's envelope is either a code
 * (`HttpError.details.code`, screaming snake case) or a free-form message —
 * only the former is safe to promote. Everything else falls back to the status
 * code, which is what the HTTP semantic conventions prescribe anyway.
 */
function extractCode(body: unknown): string | undefined {
  if (body === null || typeof body !== "object") return undefined;
  const code = (body as Record<string, unknown>).error;
  if (typeof code !== "string") return undefined;
  return /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : undefined;
}

/**
 * Wraps `res.json` so any response with a 4xx/5xx status leaves its body behind
 * for the OTel response hook. Register this before anything that can respond.
 *
 * Responses that never go through `res.json` are not captured — notably
 * Express' built-in 404, which finalhandler writes as HTML. For those the
 * status code and `http.route` on the span already tell the whole story.
 */
export function captureErrorBody(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  const originalJson = res.json.bind(res);
  res.json = function capturingJson(body?: unknown): Response {
    if (res.statusCode >= 400) {
      const existing = (res as Response & Carrier)[CAPTURED_ERROR];
      (res as Response & Carrier)[CAPTURED_ERROR] = {
        code: extractCode(body),
        body: serialize(body),
        // `recordAppError` runs before the handler responds, so keep the stack
        // it attached rather than dropping it here.
        error: existing?.error,
      };
    }
    return originalJson(body);
  } as Response["json"];
  next();
}

/**
 * Attaches the original `Error` so the response hook can record it as a span
 * exception, giving the trace a stack. Called from `errorHandler` for failures
 * that are genuinely ours; expected 4xx business errors do not need a stack.
 */
export function recordAppError(res: Response, error: Error): void {
  const carrier = res as Response & Carrier;
  // `body: ""` is only a default — an already-captured body wins, so this stays
  // correct whichever order the two run in.
  carrier[CAPTURED_ERROR] = { body: "", ...carrier[CAPTURED_ERROR], error };
}
