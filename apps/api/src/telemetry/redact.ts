/**
 * Redaction and safe serialization for anything leaving the process as
 * telemetry — span attributes, log fields, error bodies.
 *
 * This module has **no imports, and must never gain one.** `error-capture.ts`
 * depends on it at runtime, and `error-capture.ts` is itself imported by
 * `instrumentation.ts`, which loads before Express so the auto-instrumentations
 * can patch it. A value import here would be pulled in at that moment; if it
 * ever reached an instrumented library, that library would load un-patched and
 * silently produce no telemetry.
 */

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

/** Depth guard: the payloads here are shallow, and cycles must not hang the walk. */
const MAX_DEPTH = 6;

/** Enough for an error envelope or a log field bag, well short of where size matters. */
const DEFAULT_MAX_CHARS = 2048;

/** `apiKey` -> ["api","key"], `access_token` -> ["access","token"]. */
function segments(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_\-.]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());
}

export function isSensitive(key: string): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_FRAGMENTS.some((fragment) => lower.includes(fragment))) return true;
  return segments(key).some((segment) => SENSITIVE_SEGMENTS.has(segment));
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEPTH) return "[max depth]";
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value === null || typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitive(key) ? "[redacted]" : redact(nested, depth + 1);
  }
  return out;
}

export function serialize(body: unknown, maxChars = DEFAULT_MAX_CHARS): string {
  let text: string;
  try {
    text = typeof body === "string" ? body : (JSON.stringify(redact(body)) ?? "");
  } catch {
    // Cycles are already handled by the depth guard in `redact`; what reaches
    // here is a value JSON cannot express at all, such as a BigInt. The caller
    // always has other context, so a marker beats losing the whole field.
    return "[unserializable]";
  }
  return text.length > maxChars ? `${text.slice(0, maxChars)}…[truncated]` : text;
}
