import { randomUUID } from "node:crypto";
import flexibleSubscriptionCreated from "./__fixtures__/subscription-created.flexible.json" with { type: "json" };
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeAcademy, makeUser } from "../../testing/factories/index.js";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import { InMemoryUserRepository } from "../user/user.repository.in-memory.js";
import { InMemoryManagerSubscriptionRepository } from "./manager-subscription.repository.in-memory.js";
import { StripeSubscriptionWebhookHandler } from "./stripe-subscription-webhook.handler.js";

const { emitted } = vi.hoisted(() => ({
  emitted: [] as { name: string; fields: Record<string, unknown> }[],
}));

vi.mock("../../telemetry/events.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../telemetry/events.js")>()),
  emitEvent: (name: string, fields: Record<string, unknown>) => {
    emitted.push({ name, fields });
  },
}));

beforeEach(() => {
  emitted.length = 0;
});

const CLERK_USER_ID = "user_webhook_test";
const PERIOD_END_SECONDS = 1_800_000_000;

/**
 * A subscription as Stripe v21 sends it: the billing period lives on the
 * subscription item, and the top-level `current_period_end` the handler used to
 * read is simply absent.
 */
function subscriptionEvent(
  opts: { periodEndSeconds?: number | null; legacyPeriodEnd?: number } = {},
): Stripe.Event {
  const item: Record<string, unknown> = { id: "si_1", price: { id: "price_1" } };
  if (opts.periodEndSeconds != null) {
    item.current_period_end = opts.periodEndSeconds;
  }

  const subscription: Record<string, unknown> = {
    id: "sub_new_billing_mode",
    customer: "cus_1",
    status: "trialing",
    trial_end: null,
    cancel_at: null,
    metadata: { clerkUserId: CLERK_USER_ID },
    items: { data: [item] },
  };
  if (opts.legacyPeriodEnd != null) {
    subscription.current_period_end = opts.legacyPeriodEnd;
  }

  return {
    type: "customer.subscription.created",
    data: { object: subscription },
  } as unknown as Stripe.Event;
}

function setup() {
  const user = makeUser({ clerkUserId: CLERK_USER_ID });
  const academy = makeAcademy({ ownerId: user.id });
  const subRepo = new InMemoryManagerSubscriptionRepository([]);
  const handler = new StripeSubscriptionWebhookHandler(
    subRepo,
    new InMemoryAcademyRepository([academy]),
    new InMemoryUserRepository([user]),
    null,
  );
  return { handler, subRepo, academy };
}

/**
 * Production evidence: `customer.subscription.created` answered
 * `{"error":"Invalid time value"}` and the manager's subscription was never
 * recorded. `new Date(undefined * 1000)` is an Invalid Date, and it only throws
 * once Drizzle calls `toISOString()` while building the query — so the write,
 * the activation event and the welcome email were all lost together.
 */
describe("customer.subscription.created with the v21 subscription shape", () => {
  it("records the subscription with the period read off the item", async () => {
    const { handler, subRepo, academy } = setup();

    await handler.handleEvent(
      subscriptionEvent({ periodEndSeconds: PERIOD_END_SECONDS }),
    );

    const saved = await subRepo.findByAcademyId(academy.id);
    expect(saved).toBeDefined();
    expect(saved!.plan).toBe("pro");
    expect(saved!.status).toBe("trialing");
    expect(saved!.stripeSubscriptionId).toBe("sub_new_billing_mode");
    expect(saved!.currentPeriodEnd).toEqual(
      new Date(PERIOD_END_SECONDS * 1000),
    );
  });

  it("still records the subscription when Stripe sends no period at all", async () => {
    const { handler, subRepo, academy } = setup();

    await handler.handleEvent(subscriptionEvent({ periodEndSeconds: null }));

    const saved = await subRepo.findByAcademyId(academy.id);
    expect(saved).toBeDefined();
    expect(saved!.currentPeriodEnd).toBeNull();
  });

  it("accepts the legacy top-level period for older subscriptions", async () => {
    const { handler, subRepo, academy } = setup();

    await handler.handleEvent(
      subscriptionEvent({
        periodEndSeconds: null,
        legacyPeriodEnd: PERIOD_END_SECONDS,
      }),
    );

    const saved = await subRepo.findByAcademyId(academy.id);
    expect(saved!.currentPeriodEnd).toEqual(
      new Date(PERIOD_END_SECONDS * 1000),
    );
  });

  it("updates an existing row without choking on the missing period", async () => {
    const user = makeUser({ clerkUserId: CLERK_USER_ID });
    const academy = makeAcademy({ ownerId: user.id });
    const subRepo = new InMemoryManagerSubscriptionRepository([]);
    await subRepo.create({
      academyId: academy.id,
      plan: "pro",
      status: "incomplete",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_new_billing_mode",
      stripePriceId: "price_1",
      currentPeriodEnd: null,
      trialEndsAt: null,
    });
    const handler = new StripeSubscriptionWebhookHandler(
      subRepo,
      new InMemoryAcademyRepository([academy]),
      new InMemoryUserRepository([user]),
      null,
    );

    await handler.handleEvent(
      subscriptionEvent({ periodEndSeconds: PERIOD_END_SECONDS }),
    );

    const saved = await subRepo.findByAcademyId(academy.id);
    expect(saved!.status).toBe("trialing");
    expect(saved!.currentPeriodEnd).toEqual(
      new Date(PERIOD_END_SECONDS * 1000),
    );
  });

  it("writes a period Postgres can store, never an Invalid Date", async () => {
    const { handler, subRepo, academy } = setup();

    await handler.handleEvent(
      subscriptionEvent({ periodEndSeconds: Number.NaN }),
    );

    const saved = await subRepo.findByAcademyId(academy.id);
    expect(() => saved!.currentPeriodEnd?.toISOString()).not.toThrow();
  });
});

describe("unknown clerk user", () => {
  it("does not record anything", async () => {
    const academy = makeAcademy({ ownerId: randomUUID() });
    const subRepo = new InMemoryManagerSubscriptionRepository([]);
    const handler = new StripeSubscriptionWebhookHandler(
      subRepo,
      new InMemoryAcademyRepository([academy]),
      new InMemoryUserRepository([]),
      null,
    );

    await handler.handleEvent(
      subscriptionEvent({ periodEndSeconds: PERIOD_END_SECONDS }),
    );

    expect(await subRepo.findByAcademyId(academy.id)).toBeUndefined();
  });
});

/**
 * The exact event Stripe delivered in production, trimmed only of fields the
 * handler never reads. `billing_mode.type` is "flexible" — the new mode — and
 * the payload carries no top-level `current_period_end` at all, which is what
 * the handler used to read.
 */
describe("the production payload that failed", () => {
  const CLERK_ID = "user_3JxbrNmuyg9b7JQ8Pm1cEfKcjs9";
  const ITEM_PERIOD_END = 1_793_207_582;

  it("carries the period only on the item", () => {
    const sub = flexibleSubscriptionCreated.data.object;

    expect(sub).not.toHaveProperty("current_period_end");
    expect(sub.items.data[0]?.current_period_end).toBe(ITEM_PERIOD_END);
    expect(sub.billing_mode.type).toBe("flexible");
  });

  it("records the subscription instead of failing the webhook", async () => {
    const user = makeUser({ clerkUserId: CLERK_ID });
    const academy = makeAcademy({ ownerId: user.id });
    const subRepo = new InMemoryManagerSubscriptionRepository([]);
    const handler = new StripeSubscriptionWebhookHandler(
      subRepo,
      new InMemoryAcademyRepository([academy]),
      new InMemoryUserRepository([user]),
      null,
    );

    await handler.handleEvent(
      flexibleSubscriptionCreated as unknown as Stripe.Event,
    );

    const saved = await subRepo.findByAcademyId(academy.id);
    expect(saved).toBeDefined();
    expect(saved!.plan).toBe("pro");
    expect(saved!.status).toBe("trialing");
    expect(saved!.stripeSubscriptionId).toBe("sub_1UKi6uKxAZnjqqVoXReInSbv");
    expect(saved!.stripeCustomerId).toBe("cus_VLMJbCmIKL8hKu");
    expect(saved!.stripePriceId).toBe("price_1RX97RKxAZnjqqVoKL414xu8");
    expect(saved!.currentPeriodEnd).toEqual(new Date(ITEM_PERIOD_END * 1000));
    expect(saved!.trialEndsAt).toEqual(new Date(ITEM_PERIOD_END * 1000));
  });
});


/**
 * TAT-185. A manager subscribed twice on one Stripe Customer. The handler looked
 * the subscription up by id and, on a miss, fell back to the customer id — then
 * overwrote whatever row it found with the event's subscription. With two
 * subscriptions sharing a Customer, every event from either one repointed the
 * academy's row, and which subscription the app honoured was decided by whoever
 * emitted last.
 *
 * `academy_id` and `stripe_subscription_id` are both unique, so there is no
 * version of this where both subscriptions are recorded. The row that is already
 * linked wins, and the duplicate is reported instead of applied.
 */
describe("a second subscription on the same Stripe Customer", () => {
  const CUSTOMER = "cus_shared";

  function updatedEvent(subscriptionId: string, status = "canceled"): Stripe.Event {
    return {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: subscriptionId,
          customer: CUSTOMER,
          status,
          trial_end: null,
          cancel_at: 1_700_000_000,
          metadata: { clerkUserId: CLERK_USER_ID },
          items: { data: [{ id: "si_1", price: { id: "price_1" } }] },
        },
      },
    } as unknown as Stripe.Event;
  }

  async function seedLinkedAcademy() {
    const user = makeUser({ clerkUserId: CLERK_USER_ID });
    const academy = makeAcademy({ ownerId: user.id });
    const subRepo = new InMemoryManagerSubscriptionRepository([]);
    await subRepo.create({
      academyId: academy.id,
      plan: "pro",
      status: "trialing",
      stripeCustomerId: CUSTOMER,
      stripeSubscriptionId: "sub_first",
      stripePriceId: "price_1",
      currentPeriodEnd: null,
      trialEndsAt: null,
    });
    const userRepo = new InMemoryUserRepository([user]);
    const handler = new StripeSubscriptionWebhookHandler(
      subRepo,
      new InMemoryAcademyRepository([academy]),
      userRepo,
      null,
    );
    return { handler, subRepo, userRepo, user, academy };
  }

  it("leaves the linked row untouched when a different subscription reports", async () => {
    const { handler, subRepo, academy } = await seedLinkedAcademy();

    await handler.handleEvent(updatedEvent("sub_duplicate"));

    const saved = await subRepo.findByAcademyId(academy.id);
    expect(saved!.stripeSubscriptionId).toBe("sub_first");
    expect(saved!.status).toBe("trialing");
    expect(saved!.canceledAt).toBeNull();
  });

  it("reports the duplicate instead of applying it", async () => {
    const { handler } = await seedLinkedAcademy();

    await handler.handleEvent(updatedEvent("sub_duplicate"));

    expect(emitted).toContainEqual(
      expect.objectContaining({
        name: "manager_subscription.webhook_unhandled",
        fields: expect.objectContaining({
          reason: "DUPLICATE_SUBSCRIPTION",
          stripeSubscriptionId: "sub_duplicate",
        }),
      }),
    );
  });

  /**
   * Falling through to the pending-on-user branch would park the duplicate on
   * the user row, and `linkPendingSubscription` would then overwrite the academy
   * row the moment an academy is created — the same hijack, just deferred.
   */
  it("does not park the duplicate as the user's pending subscription", async () => {
    const { handler, userRepo, user } = await seedLinkedAcademy();

    await handler.handleEvent(updatedEvent("sub_duplicate"));

    const saved = await userRepo.findById(user.id);
    expect(saved!.pendingStripeSubscriptionId).toBeNull();
  });

  it("still applies an event that matches the row's own subscription id", async () => {
    const { handler, subRepo, academy } = await seedLinkedAcademy();

    await handler.handleEvent(updatedEvent("sub_first"));

    const saved = await subRepo.findByAcademyId(academy.id);
    expect(saved!.stripeSubscriptionId).toBe("sub_first");
    expect(saved!.status).toBe("canceled");
  });

  /**
   * The fallback exists for the pending-academy path: a row created with a
   * customer id but no subscription id yet. Narrowing it must not close that.
   */
  it("still adopts the event when the matched row has no subscription id yet", async () => {
    const user = makeUser({ clerkUserId: CLERK_USER_ID });
    const academy = makeAcademy({ ownerId: user.id });
    const subRepo = new InMemoryManagerSubscriptionRepository([]);
    await subRepo.create({
      academyId: academy.id,
      plan: "pro",
      status: "incomplete",
      stripeCustomerId: CUSTOMER,
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null,
      trialEndsAt: null,
    });
    const handler = new StripeSubscriptionWebhookHandler(
      subRepo,
      new InMemoryAcademyRepository([academy]),
      new InMemoryUserRepository([user]),
      null,
    );

    await handler.handleEvent(updatedEvent("sub_first", "active"));

    const saved = await subRepo.findByAcademyId(academy.id);
    expect(saved!.stripeSubscriptionId).toBe("sub_first");
    expect(saved!.status).toBe("active");
  });
});
