import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import { InMemoryUserRepository } from "../user/user.repository.in-memory.js";
import {
  makeAcademy,
  makeManagerSubscription,
  makeUser,
} from "../../testing/factories/index.js";
import { InMemoryManagerSubscriptionRepository } from "./manager-subscription.repository.in-memory.js";
import { RevenueCatWebhookHandler } from "./revenuecat-webhook.handler.js";
import type { RevenueCatEvent } from "./revenuecat-events.js";

function setup() {
  const userId = randomUUID();
  const user = makeUser({ id: userId });
  const academy = makeAcademy({ ownerId: userId });
  const existingSub = makeManagerSubscription({
    academyId: academy.id,
    plan: "free",
    status: "active",
  });

  const subRepo = new InMemoryManagerSubscriptionRepository([existingSub]);
  const userRepo = new InMemoryUserRepository([user]);
  const acadRepo = new InMemoryAcademyRepository([academy]);

  const emailService = {
    sendProActivated: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionCanceled: vi.fn().mockResolvedValue(undefined),
  };

  const handler = new RevenueCatWebhookHandler(
    subRepo,
    userRepo,
    acadRepo,
    emailService as any,
  );

  return { handler, subRepo, userRepo, acadRepo, emailService, user, academy, clerkUserId: user.clerkUserId };
}

function initialPurchaseEvent(
  clerkUserId: string,
  overrides: Partial<RevenueCatEvent["event"]> = {},
): RevenueCatEvent {
  return {
    event: {
      type: "INITIAL_PURCHASE",
      id: randomUUID(),
      app_user_id: clerkUserId,
      product_id: "tatame_pro_monthly",
      original_transaction_id: "1000000000000000",
      store: "APP_STORE",
      event_timestamp_ms: Date.now(),
      expiration_at_ms: Date.now() + 30 * 24 * 3600 * 1000,
      environment: "PRODUCTION",
      ...overrides,
    },
    api_version: "1.0",
  };
}

describe("RevenueCatWebhookHandler", () => {
  describe("INITIAL_PURCHASE", () => {
    it("upserts the subscription to plan=pro, status=active, fills RevenueCat fields", async () => {
      const { handler, subRepo, user, academy, clerkUserId } = setup();

      await handler.handleEvent(initialPurchaseEvent(clerkUserId));

      const sub = await subRepo.findByAcademyId(academy.id);
      expect(sub).toBeDefined();
      expect(sub!.plan).toBe("pro");
      expect(sub!.status).toBe("active");
      expect(sub!.revenuecatAppUserId).toBe(clerkUserId);
      expect(sub!.productId).toBe("tatame_pro_monthly");
      expect(sub!.originalTransactionId).toBe("1000000000000000");
      expect(sub!.store).toBe("app_store");
      expect(sub!.canceledAt).toBeNull();
      expect(sub!.currentPeriodEnd).toBeInstanceOf(Date);
    });

    it("enqueues the pro-activated email", async () => {
      const { handler, emailService, clerkUserId } = setup();

      await handler.handleEvent(initialPurchaseEvent(clerkUserId));

      expect(emailService.sendProActivated).toHaveBeenCalledOnce();
    });
  });

  describe("CANCELLATION", () => {
    it("sets canceledAt while keeping status=active and plan=pro", async () => {
      const { handler, subRepo, user, academy, clerkUserId } = setup();
      await handler.handleEvent(initialPurchaseEvent(clerkUserId));

      await handler.handleEvent({
        event: {
          type: "CANCELLATION",
          id: randomUUID(),
          app_user_id: clerkUserId,
          product_id: "tatame_pro_monthly",
          original_transaction_id: "1000000000000000",
          store: "APP_STORE",
          event_timestamp_ms: Date.now(),
          expiration_at_ms: Date.now() + 30 * 24 * 3600 * 1000,
        },
        api_version: "1.0",
      });

      const sub = await subRepo.findByAcademyId(academy.id);
      expect(sub!.plan).toBe("pro");
      expect(sub!.status).toBe("active");
      expect(sub!.canceledAt).toBeInstanceOf(Date);
    });
  });

  describe("UNCANCELLATION", () => {
    it("clears canceledAt", async () => {
      const { handler, subRepo, user, academy, clerkUserId } = setup();
      await handler.handleEvent(initialPurchaseEvent(clerkUserId));
      await handler.handleEvent({
        event: {
          type: "CANCELLATION",
          id: randomUUID(),
          app_user_id: clerkUserId,
          event_timestamp_ms: Date.now(),
        },
        api_version: "1.0",
      });

      await handler.handleEvent({
        event: {
          type: "UNCANCELLATION",
          id: randomUUID(),
          app_user_id: clerkUserId,
          event_timestamp_ms: Date.now(),
        },
        api_version: "1.0",
      });

      const sub = await subRepo.findByAcademyId(academy.id);
      expect(sub!.canceledAt).toBeNull();
      expect(sub!.status).toBe("active");
    });
  });

  describe("EXPIRATION", () => {
    it("downgrades to plan=free, status=canceled, keeps currentPeriodEnd", async () => {
      const { handler, subRepo, user, academy, emailService, clerkUserId } = setup();
      await handler.handleEvent(initialPurchaseEvent(clerkUserId));
      const before = await subRepo.findByAcademyId(academy.id);
      const periodEndBefore = before!.currentPeriodEnd;

      await handler.handleEvent({
        event: {
          type: "EXPIRATION",
          id: randomUUID(),
          app_user_id: clerkUserId,
          event_timestamp_ms: Date.now(),
          product_id: "tatame_pro_monthly",
          store: "APP_STORE",
        },
        api_version: "1.0",
      });

      const sub = await subRepo.findByAcademyId(academy.id);
      expect(sub!.plan).toBe("free");
      expect(sub!.status).toBe("canceled");
      expect(sub!.currentPeriodEnd).toEqual(periodEndBefore);
      expect(emailService.sendSubscriptionCanceled).toHaveBeenCalledOnce();
    });
  });

  describe("REFUND", () => {
    it("sets plan=free, status=canceled, canceledAt=now()", async () => {
      const { handler, subRepo, user, academy, clerkUserId } = setup();
      await handler.handleEvent(initialPurchaseEvent(clerkUserId));

      await handler.handleEvent({
        event: {
          type: "REFUND",
          id: randomUUID(),
          app_user_id: clerkUserId,
          event_timestamp_ms: Date.now(),
        },
        api_version: "1.0",
      });

      const sub = await subRepo.findByAcademyId(academy.id);
      expect(sub!.plan).toBe("free");
      expect(sub!.status).toBe("canceled");
      expect(sub!.canceledAt).toBeInstanceOf(Date);
    });
  });

  describe("BILLING_ISSUE", () => {
    it("sets status=past_due, keeps plan=pro", async () => {
      const { handler, subRepo, user, academy, clerkUserId } = setup();
      await handler.handleEvent(initialPurchaseEvent(clerkUserId));

      await handler.handleEvent({
        event: {
          type: "BILLING_ISSUE",
          id: randomUUID(),
          app_user_id: clerkUserId,
          event_timestamp_ms: Date.now(),
        },
        api_version: "1.0",
      });

      const sub = await subRepo.findByAcademyId(academy.id);
      expect(sub!.plan).toBe("pro");
      expect(sub!.status).toBe("past_due");
    });
  });

  describe("idempotency", () => {
    it("applying the same INITIAL_PURCHASE twice yields the same final state", async () => {
      const { handler, subRepo, user, academy, clerkUserId } = setup();
      const ev = initialPurchaseEvent(clerkUserId);
      await handler.handleEvent(ev);
      const after1 = { ...(await subRepo.findByAcademyId(academy.id))! };
      await handler.handleEvent(ev);
      const after2 = { ...(await subRepo.findByAcademyId(academy.id))! };
      expect(after2.plan).toBe(after1.plan);
      expect(after2.status).toBe(after1.status);
      expect(after2.productId).toBe(after1.productId);
      expect(after2.originalTransactionId).toBe(after1.originalTransactionId);
    });
  });

  describe("unknown event types", () => {
    it("does not throw on TEST events", async () => {
      const { handler, clerkUserId } = setup();
      await expect(
        handler.handleEvent({
          event: {
            type: "TEST",
            id: randomUUID(),
            app_user_id: clerkUserId,
            event_timestamp_ms: Date.now(),
          },
          api_version: "1.0",
        }),
      ).resolves.not.toThrow();
    });
  });
});
