import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { subscriptionPeriodEnd } from "./stripe.js";

/**
 * Stripe v21 moved `current_period_end` onto the subscription item. Reading the
 * removed top-level field produced `new Date(undefined * 1000)` — an Invalid
 * Date that passed every check until Drizzle called `toISOString()` on it,
 * failing the webhook with `RangeError: Invalid time value`. The subscription
 * was never written and no activation email went out, so a paying manager was
 * silently left without a subscription.
 */
function makeSubscription(
  item: Record<string, unknown> | null,
  extra: Record<string, unknown> = {},
): Stripe.Subscription {
  return {
    id: "sub_test",
    items: { data: item ? [item] : [] },
    ...extra,
  } as unknown as Stripe.Subscription;
}

const EPOCH_SECONDS = 1_800_000_000;

describe("subscriptionPeriodEnd", () => {
  it("reads the period end off the subscription item", () => {
    const sub = makeSubscription({ current_period_end: EPOCH_SECONDS });

    expect(subscriptionPeriodEnd(sub)).toEqual(new Date(EPOCH_SECONDS * 1000));
  });

  it("falls back to the legacy top-level field", () => {
    const sub = makeSubscription(null, { current_period_end: EPOCH_SECONDS });

    expect(subscriptionPeriodEnd(sub)).toEqual(new Date(EPOCH_SECONDS * 1000));
  });

  it("prefers the item over the legacy field when both are present", () => {
    const sub = makeSubscription(
      { current_period_end: EPOCH_SECONDS },
      { current_period_end: 1 },
    );

    expect(subscriptionPeriodEnd(sub)).toEqual(new Date(EPOCH_SECONDS * 1000));
  });

  it("returns null when neither shape carries a period", () => {
    expect(subscriptionPeriodEnd(makeSubscription(null))).toBeNull();
  });

  it("returns null when the item exists without a period", () => {
    expect(subscriptionPeriodEnd(makeSubscription({ id: "si_1" }))).toBeNull();
  });

  it("returns null rather than an Invalid Date for a non-numeric value", () => {
    const sub = makeSubscription({ current_period_end: "not-a-number" });

    expect(subscriptionPeriodEnd(sub)).toBeNull();
  });

  it("never returns a Date that would throw on toISOString", () => {
    for (const item of [
      null,
      { id: "si_1" },
      { current_period_end: undefined },
      { current_period_end: Number.NaN },
      { current_period_end: "1800000000" },
    ]) {
      const result = subscriptionPeriodEnd(makeSubscription(item));
      expect(() => result?.toISOString()).not.toThrow();
    }
  });
});
