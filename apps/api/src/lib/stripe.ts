import Stripe from "stripe";
import { loadEnv } from "@tatame/config";

/**
 * Stripe v21 removed `current_period_end` from the Subscription type (new billing
 * mode), but the field is still present in payloads for subscriptions using the
 * legacy/fixed billing mode.
 */
export type SubscriptionWithPeriod = Stripe.Subscription & {
  current_period_end: number;
};

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
