/**
 * The catalog of business events the API emits, and the only way to emit one.
 *
 * The point of this module is that `event.name` and `event.reason` are closed
 * sets the compiler enforces. A rejected check-in is not a 409 with prose — it
 * is `checkin.rejected` with `WEEKLY_LIMIT_REACHED`, which is the difference
 * between "why were check-ins refused this week?" being a LogQL query and being
 * an afternoon of reading source.
 *
 * Adding an event is one entry here plus one call site. Adding a *reason* to an
 * existing event is one string.
 */
import type { Role } from "@tatame/types";
import { log } from "./logger.js";

type Outcome = "success" | "rejected" | "failed";

interface EventDefinition {
  domain: string;
  outcome: Outcome;
  reasons?: readonly string[];
}

/**
 * Every event this API can emit. The key is `<domain>.<action>`; the `domain`
 * field repeats the prefix because it becomes its own attribute, and a unit test
 * pins the two together so they cannot drift.
 */
export const CATALOG = {
  // --- checkin ------------------------------------------------------------
  "checkin.created": { domain: "checkin", outcome: "success" },
  "checkin.rejected": {
    domain: "checkin",
    outcome: "rejected",
    reasons: [
      "NOT_A_STUDENT",
      "NO_ACTIVE_MEMBERSHIP",
      "CLASS_NOT_FOUND",
      "WRONG_WEEKDAY",
      "WINDOW_CLOSED",
      "CLASS_FULL",
      "WEEKLY_LIMIT_REACHED",
      "DUPLICATE",
      "LOCK_BUSY",
      "MISSING_DEPENDENT",
    ],
  },

  // --- membership ---------------------------------------------------------
  "membership.requested": { domain: "membership", outcome: "success" },
  "membership.approved": { domain: "membership", outcome: "success" },
  "membership.rejected": { domain: "membership", outcome: "success" },
  "membership.blocked": { domain: "membership", outcome: "success" },
  "membership.unblocked": { domain: "membership", outcome: "success" },
  "membership.left": { domain: "membership", outcome: "success" },

  // --- subscription (student plans) ---------------------------------------
  "subscription.plan_created": { domain: "subscription", outcome: "success" },
  "subscription.plan_updated": { domain: "subscription", outcome: "success" },
  "subscription.plan_assigned": { domain: "subscription", outcome: "success" },

  // --- payment ------------------------------------------------------------
  "payment.created": { domain: "payment", outcome: "success" },
  "payment.checkout_started": { domain: "payment", outcome: "success" },
  "payment.confirmed": { domain: "payment", outcome: "success" },
  // No `payment.failed`. Both webhook handlers process only the success event
  // (`checkout.session.completed`, `billing.paid`) and return silently on
  // anything else, so the API has no student-payment failure path to report. The
  // entry was in the spec's catalog; it was removed rather than left as an event
  // that could never fire.
  "payment.transferred": { domain: "payment", outcome: "success" },

  // --- manager_subscription (the Pro plan, via Stripe) --------------------
  "manager_subscription.checkout_started": {
    domain: "manager_subscription",
    outcome: "success",
  },
  "manager_subscription.activated": {
    domain: "manager_subscription",
    outcome: "success",
  },
  "manager_subscription.canceled": {
    domain: "manager_subscription",
    outcome: "success",
  },
  "manager_subscription.past_due": {
    domain: "manager_subscription",
    outcome: "rejected",
    reasons: ["PAYMENT_FAILED"],
  },
  "manager_subscription.trial_ending": {
    domain: "manager_subscription",
    outcome: "success",
  },
  "manager_subscription.webhook_unhandled": {
    domain: "manager_subscription",
    outcome: "rejected",
    reasons: ["UNKNOWN_EVENT_TYPE", "NO_ACADEMY_OR_USER", "USER_NOT_FOUND", "NO_RECORD"],
  },

  // --- graduation ---------------------------------------------------------
  "graduation.initial_set": { domain: "graduation", outcome: "success" },
  "graduation.promoted": { domain: "graduation", outcome: "success" },
  "graduation.rejected": {
    domain: "graduation",
    outcome: "rejected",
    reasons: ["INVALID_PROMOTION", "INVALID_BELT_RANK"],
  },

  // --- access (who was turned away, and why) ------------------------------
  "access.denied": {
    domain: "access",
    outcome: "rejected",
    // No `FEATURE_LOCKED`: `requirePlanFeature` currently calls `next()`
    // unconditionally, so nothing can be refused for a locked feature. Add the
    // reason back when that middleware starts enforcing something.
    reasons: ["NO_SESSION", "ROLE_FORBIDDEN", "PLAN_REQUIRED", "RATE_LIMITED"],
  },

  // --- request (the failures that are ours) -------------------------------
  "request.failed": { domain: "request", outcome: "failed" },
} as const satisfies Record<string, EventDefinition>;

export type EventName = keyof typeof CATALOG;

/**
 * The reasons a given event declares — `never` for events that declare none.
 * Exported so a call site can type a local helper that funnels every refusal in
 * one function through a single `emitEvent`.
 */
export type EventReason<N extends EventName> = (typeof CATALOG)[N] extends {
  reasons: readonly (infer R)[];
}
  ? R
  : never;

type ReasonOf<N extends EventName> = EventReason<N>;

/**
 * The identifiers events are allowed to carry. Closed on purpose — no index
 * signature — so attribute names cannot drift between call sites, and so there
 * is simply no `email` or `phone` key to pass. `extra` is the one escape hatch,
 * and it is visibly one.
 */
export interface EventFields {
  userId?: string;
  actorRole?: Role;
  academyId?: string;
  classId?: string;
  checkinId?: string;
  membershipId?: string;
  dependentId?: string;
  subscriptionId?: string;
  planId?: string;
  paymentId?: string;
  graduationId?: string;
  announcementId?: string;
  clerkUserId?: string;
  stripeSubscriptionId?: string;
  /** Domain-specific, non-identifying detail. Redacted like everything else. */
  extra?: Record<string, unknown>;
  /** The cause, on a `failed` outcome. Becomes `exception.*`. */
  err?: unknown;
}

/** `userId` -> `user.id`. Written out rather than derived, so it is greppable. */
const ATTRIBUTE_NAMES: Record<
  Exclude<keyof EventFields, "extra" | "err">,
  string
> = {
  userId: "user.id",
  actorRole: "app.actor.role",
  academyId: "app.academy.id",
  classId: "app.class.id",
  checkinId: "app.checkin.id",
  membershipId: "app.membership.id",
  dependentId: "app.dependent.id",
  subscriptionId: "app.subscription.id",
  planId: "app.plan.id",
  paymentId: "app.payment.id",
  graduationId: "app.graduation.id",
  announcementId: "app.announcement.id",
  clerkUserId: "app.clerk.user.id",
  stripeSubscriptionId: "app.stripe.subscription.id",
};

/** An outcome maps to the severity you would want to be alerted at. */
const LEVEL_FOR: Record<Outcome, "info" | "warn" | "error"> = {
  success: "info",
  rejected: "warn",
  failed: "error",
};

/** `reason` is required exactly when the catalog entry declares reasons. */
type ReasonField<N extends EventName> = [ReasonOf<N>] extends [never]
  ? { reason?: never }
  : { reason: ReasonOf<N> };

/**
 * Emits one catalog event. Goes through `log`, so it lands on stdout and in Loki
 * with the active span's `trace_id` already attached.
 */
export function emitEvent<N extends EventName>(
  name: N,
  fields: EventFields & ReasonField<N>,
): void {
  try {
    const definition: EventDefinition = CATALOG[name];
    const { extra, err, reason, ...identifiers } = fields as EventFields & {
      reason?: string;
    };

    const attributes: Record<string, unknown> = {
      "event.name": name,
      "event.domain": definition.domain,
      "event.outcome": definition.outcome,
    };
    if (reason) attributes["event.reason"] = reason;

    for (const [key, value] of Object.entries(identifiers)) {
      if (value === undefined) continue;
      attributes[ATTRIBUTE_NAMES[key as keyof typeof ATTRIBUTE_NAMES]] = value;
    }
    // Prefixed so a caller cannot shadow `user.id` or `event.outcome` from
    // inside the escape hatch.
    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        attributes[`app.${key}`] = value;
      }
    }
    if (err !== undefined) attributes.err = err;

    // `logger.ts` promotes the `event.name` attribute onto the record's native
    // `eventName` field. Loki drops that field on ingest, so the attribute is
    // what queries use — but it costs nothing to populate the place semconv
    // says the value belongs.
    log[LEVEL_FOR[definition.outcome]](name, attributes);
  } catch {
    // An event that cannot be emitted must not fail the action it describes.
  }
}
