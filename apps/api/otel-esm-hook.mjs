/**
 * ESM loader hook for OpenTelemetry — loaded via `node --import` (see the `dev`
 * and `start` scripts) because it has to run before any module is resolved.
 *
 * Why this file exists: the auto-instrumentations patch libraries as they are
 * loaded. That works out of the box for Node builtins (`http`) and for packages
 * that publish diagnostics channels (`undici`), but a plain `import express from
 * "express"` in an ESM app bypasses the CommonJS require hook — so Express is
 * never patched and every HTTP metric comes back without an `http.route` label.
 * `import-in-the-middle` fixes that by hooking the ESM loader itself.
 *
 * The hook is scoped to `express` on purpose. Wrapping everything makes
 * `import-in-the-middle` rewrite the app's own modules and re-export barrels,
 * which breaks on drizzle-orm ("conflicting star exports"). Add a module name
 * here only when you also add its instrumentation.
 *
 * Deliberately unconditional: this runs at `--import` time, before
 * `env-bootstrap.js` has loaded the root `.env`, so `process.env.OTEL_COLLECTOR_URL`
 * is still empty here whenever it is configured the documented way. Guarding on it
 * silently cost every request its `http.route` label. Registering always is cheap —
 * it wraps one module at startup, and `instrumentation.ts` still decides whether any
 * telemetry is produced at all.
 */
import { register } from "node:module";

register("@opentelemetry/instrumentation/hook.mjs", import.meta.url, {
  data: { include: ["express"] },
});
