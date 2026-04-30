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
