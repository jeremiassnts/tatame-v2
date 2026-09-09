# Observability — Logs Context

**Gathered:** 2026-09-08
**Spec:** `.specs/features/observability-logs/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Ship Loki as the log store for `apps/api`, fed through the existing OTel Collector, and define a
named catalog of domain events for the core business actions so the API's behaviour is queryable
by domain, outcome and reason — not just greppable.

---

## Implementation Decisions

### Event catalog scope

- Hand-written, named events on the **request path only**. No generic "log every mutation"
  middleware — the value is in `checkin.rejected` + `WEEKLY_LIMIT_REACHED`, which a route-level
  middleware cannot know.
- Eight P1 domains: `checkin`, `membership`, `subscription`, `payment`, `manager_subscription`,
  `graduation`, `access`, `request`.
- Five P2 domains, same shape, added after: `announcement`, `class`, `academy`, `dependent`, `user`.
- Background workers (email, push, engagement) are **not** in the event catalog this iteration.
  They still get structured logs through the same logger and still land in Loki — they just do not
  define `event.name`s. This is the one place the two decisions below meet and could read as a
  contradiction, so it is stated explicitly.

### Transport

- SDK OTel Logs → OTLP/gRPC → Collector → Loki. Same `OTEL_COLLECTOR_URL` as metrics and traces;
  the application never learns Loki exists.
- No file-tailing agent (Alloy/Promtail). One less component, and `trace_id` correlation comes for
  free from the SDK's active context instead of being injected by hand.
- The logger still writes to stdout unconditionally. Export is an addition, never a replacement —
  a dev without the stack running must keep seeing their logs.

### Existing `console.*` calls

- All 69 migrate to the logger. `no-console` becomes a lint error for `apps/api/src`.
- Exceptions, deliberately: `instrumentation.ts` (loads before everything, cannot import the
  logger without dragging instrumented modules in early), `seed.ts` (a CLI script — its output is
  the point), and `*.test.ts`.
- The `[prefix]` convention already in use (`[push]`, `[stripe-sub-webhook]`, `[engagement]`)
  becomes a structured field. The prose stays as the message.

### Data in logs

- Internal identifiers are allowed and wanted: `user.id`, `academy.id`, `class.id`,
  `subscription.id`, `payment.id`, `clerk.user.id`.
- Personal data is not: name, email, phone, document number, address, and anything the existing
  redaction list in `telemetry/error-capture.ts` already catches.
- The redaction helper is reused rather than reimplemented — one list, one behaviour, one test.

### Agent's Discretion

- Logger implementation (a thin wrapper over the OTel Logs API vs. pino + a bridge) — settled in
  design, on the criterion of "fewest moving parts that still gives typed events and stdout".
- Exact Loki version, storage config and the Collector's log pipeline shape.
- LogQL used by the P3 dashboard panels.

---

## Specific References

- `docs/observability.md` § "Adding Loki next" already sketched this work in four steps, including
  un-collapsing the APM dashboard's `Logs` row via `scripts/build-apm-dashboard.mjs`. That sketch
  is the starting point, not a constraint.
- Existing log convention to preserve in spirit: `console.warn("[push] Invalid Expo push token,
  removing", { expoPushToken, notificationId })` — short message, structured context object.

---

## Deferred Ideas

- **Named events for workers** — job started/succeeded/failed/retried as catalog events. Wanted,
  scoped out of this iteration.
- **A Postgres audit table** — durable, user-facing history of who did what. A product feature;
  Loki retention is 7 days and is not an audit trail.
- **Alerting on rejection-reason spikes** — needs a volume baseline first.
- **Postgres query tracing** — carried over from the traces spec, still open, unrelated to logs.
