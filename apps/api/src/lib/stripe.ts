import Stripe from "stripe";
import { loadEnv } from "@tatame/config";

/**
 * Stripe v21 moved `current_period_end` off the Subscription and onto each
 * subscription item. Subscriptions created under the legacy billing mode still
 * carry the old top-level field, so both are read here.
 */
type LegacySubscriptionPeriod = { current_period_end?: number };

/**
 * The end of the current billing period, or `null` when Stripe sent neither
 * shape.
 *
 * Reading the removed top-level field directly yields `undefined`, and
 * `undefined * 1000` is `NaN` — which becomes an Invalid Date that survives
 * every check until Drizzle calls `toISOString()` on it deep inside query
 * building, failing the request with `RangeError: Invalid time value` and no
 * hint of where it came from. Returning `null` keeps a missing period a
 * missing period.
 */
export function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const fromItem = sub.items?.data?.[0]?.current_period_end;
  const fromLegacy = (sub as unknown as LegacySubscriptionPeriod)
    .current_period_end;
  const seconds = fromItem ?? fromLegacy;
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000);
}

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const env = loadEnv();
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeInstance = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-03-25.dahlia",
    });
  }
  return stripeInstance;
}

/**
 * Stripe when it is configured, `null` when it is not. Read paths that merely
 * construct a service holding a Stripe handle must not 500 on a missing
 * payment secret — the service already answers 503 from the methods that
 * genuinely need Stripe.
 */
export function getStripeOrNull(): Stripe | null {
  try {
    return getStripe();
  } catch {
    return null;
  }
}
