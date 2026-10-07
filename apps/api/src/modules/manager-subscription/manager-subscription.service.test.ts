import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  makeAcademy,
  makeManagerSubscription,
} from "../../testing/factories/index.js";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import type { AcademyRow } from "../academy/academy.repository.js";
import { InMemoryManagerSubscriptionRepository } from "./manager-subscription.repository.in-memory.js";
import type { ManagerSubscriptionRow } from "./manager-subscription.repository.js";
import { ManagerSubscriptionService } from "./manager-subscription.service.js";

function makeSvc(opts: {
  academies?: AcademyRow[];
  subscriptions?: ManagerSubscriptionRow[];
  stripe?: any;
}) {
  const acadRepo = new InMemoryAcademyRepository(opts.academies ?? []);
  const subRepo = new InMemoryManagerSubscriptionRepository(
    opts.subscriptions ?? [],
  );
  return {
    svc: new ManagerSubscriptionService(subRepo, acadRepo, opts.stripe ?? null),
    subRepo,
    acadRepo,
  };
}

describe("ManagerSubscriptionService", () => {
  describe("getSubscription", () => {
    it("returns subscription for academy", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({ academyId: academy.id });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
      });

      const result = await svc.getSubscription(academy.id);
      expect(result).toBeDefined();
      expect(result!.academyId).toBe(academy.id);
    });

    it("returns undefined when no subscription exists", async () => {
      const { svc } = makeSvc({});
      const result = await svc.getSubscription(randomUUID());
      expect(result).toBeUndefined();
    });
  });

  describe("isSubscriptionActive", () => {
    it("returns true for active status", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        status: "active",
      });
      const { svc } = makeSvc({ academies: [academy], subscriptions: [sub] });

      await expect(svc.isSubscriptionActive(academy.id)).resolves.toBe(true);
    });

    it("returns true for trialing status", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        status: "trialing",
      });
      const { svc } = makeSvc({ academies: [academy], subscriptions: [sub] });

      await expect(svc.isSubscriptionActive(academy.id)).resolves.toBe(true);
    });

    it("returns false for past_due status", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        status: "past_due",
      });
      const { svc } = makeSvc({ academies: [academy], subscriptions: [sub] });

      await expect(svc.isSubscriptionActive(academy.id)).resolves.toBe(false);
    });

    it("returns false for canceled status", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        status: "canceled",
      });
      const { svc } = makeSvc({ academies: [academy], subscriptions: [sub] });

      await expect(svc.isSubscriptionActive(academy.id)).resolves.toBe(false);
    });

    it("returns false when no subscription exists", async () => {
      const { svc } = makeSvc({});
      await expect(svc.isSubscriptionActive(randomUUID())).resolves.toBe(false);
    });
  });

  /**
   * TAT-185. Two subscriptions ended up on one Stripe Customer because nothing
   * in the checkout path ever read `manager_subscriptions`. This is the read the
   * route's 409 and the web's eligibility check both go through, so the button
   * and the endpoint can never disagree about who may subscribe.
   */
  describe("hasSubscriptionInFlight", () => {
    it("is true when an owned academy is trialing", async () => {
      const ownerId = randomUUID();
      const academy = makeAcademy({ ownerId });
      const sub = makeManagerSubscription({
        academyId: academy.id,
        status: "trialing",
      });
      const { svc } = makeSvc({ academies: [academy], subscriptions: [sub] });

      await expect(svc.hasSubscriptionInFlight(ownerId, null)).resolves.toBe(
        true,
      );
    });

    it("is true when an owned academy is active", async () => {
      const ownerId = randomUUID();
      const academy = makeAcademy({ ownerId });
      const sub = makeManagerSubscription({
        academyId: academy.id,
        status: "active",
      });
      const { svc } = makeSvc({ academies: [academy], subscriptions: [sub] });

      await expect(svc.hasSubscriptionInFlight(ownerId, null)).resolves.toBe(
        true,
      );
    });

    it("is true when the user has a pending subscription and no academy yet", async () => {
      const { svc } = makeSvc({});

      await expect(
        svc.hasSubscriptionInFlight(randomUUID(), "sub_pending_123"),
      ).resolves.toBe(true);
    });

    it("is false for a user with nothing at all", async () => {
      const { svc } = makeSvc({});

      await expect(
        svc.hasSubscriptionInFlight(randomUUID(), null),
      ).resolves.toBe(false);
    });

    // Resubscribing has to keep working. `past_due` is on this list on purpose:
    // a manager whose card failed needs a way back in, not a locked door.
    it.each(["canceled", "incomplete", "past_due"] as const)(
      "is false when the only subscription is %s",
      async (status) => {
        const ownerId = randomUUID();
        const academy = makeAcademy({ ownerId });
        const sub = makeManagerSubscription({ academyId: academy.id, status });
        const { svc } = makeSvc({ academies: [academy], subscriptions: [sub] });

        await expect(svc.hasSubscriptionInFlight(ownerId, null)).resolves.toBe(
          false,
        );
      },
    );

    it("is true when any one of several owned academies is active", async () => {
      const ownerId = randomUUID();
      const canceled = makeAcademy({ ownerId });
      const live = makeAcademy({ ownerId });
      const { svc } = makeSvc({
        academies: [canceled, live],
        subscriptions: [
          makeManagerSubscription({
            academyId: canceled.id,
            status: "canceled",
          }),
          makeManagerSubscription({ academyId: live.id, status: "active" }),
        ],
      });

      await expect(svc.hasSubscriptionInFlight(ownerId, null)).resolves.toBe(
        true,
      );
    });

    it("ignores academies the user does not own", async () => {
      const academy = makeAcademy({ ownerId: randomUUID() });
      const sub = makeManagerSubscription({
        academyId: academy.id,
        status: "active",
      });
      const { svc } = makeSvc({ academies: [academy], subscriptions: [sub] });

      await expect(
        svc.hasSubscriptionInFlight(randomUUID(), null),
      ).resolves.toBe(false);
    });
  });

  /**
   * TAT-185. Without a key, a double-submit or a retried request opens a second
   * Checkout Session, and each session Stripe completes is another subscription.
   */
  describe("createCheckoutSession", () => {
    function stripeSpy() {
      const calls: { params: unknown; options: unknown }[] = [];
      return {
        calls,
        stripe: {
          customers: {
            list: async () => ({ data: [{ id: "cus_1" }] }),
            create: async () => ({ id: "cus_1" }),
          },
          checkout: {
            sessions: {
              create: async (params: unknown, options: unknown) => {
                calls.push({ params, options });
                return { url: "https://checkout.stripe.test/s_1" };
              },
            },
          },
        },
      };
    }

    it("passes an idempotency key scoped to the caller and the price", async () => {
      const { calls, stripe } = stripeSpy();
      const { svc } = makeSvc({ stripe });

      await svc.createCheckoutSession(
        "user_clerk_1",
        "manager@example.com",
        "price_pro",
        "https://app.test/ok",
        "https://app.test/cancel",
      );

      expect(calls).toHaveLength(1);
      expect(calls[0]!.options).toEqual({
        idempotencyKey: "manager-checkout:user_clerk_1:price_pro",
      });
    });

    it("gives two different callers two different keys", async () => {
      const { calls, stripe } = stripeSpy();
      const { svc } = makeSvc({ stripe });

      await svc.createCheckoutSession(
        "user_a",
        "a@example.com",
        "price_pro",
        "https://app.test/ok",
        "https://app.test/cancel",
      );
      await svc.createCheckoutSession(
        "user_b",
        "b@example.com",
        "price_pro",
        "https://app.test/ok",
        "https://app.test/cancel",
      );

      expect(calls[0]!.options).not.toEqual(calls[1]!.options);
    });
  });

  describe("cancelSubscription", () => {
    it("throws 503 when Stripe is not configured", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        stripeSubscriptionId: "sub_test_123",
      });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
        stripe: null,
      });

      await expect(svc.cancelSubscription(academy.id)).rejects.toMatchObject({
        statusCode: 503,
      });
    });

    it("throws 404 when no subscription found", async () => {
      const stripeMock = {
        subscriptions: {
          update: async () => ({}),
        },
      };
      const { svc } = makeSvc({ stripe: stripeMock });

      await expect(svc.cancelSubscription(randomUUID())).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("throws 404 when subscription has no stripeSubscriptionId", async () => {
      const stripeMock = {
        subscriptions: {
          update: async () => ({}),
        },
      };
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        stripeSubscriptionId: null,
      });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
        stripe: stripeMock,
      });

      await expect(svc.cancelSubscription(academy.id)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
