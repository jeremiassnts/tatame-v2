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

  return { handler, subRepo, userRepo, acadRepo, emailService, user, academy };
}

function initialPurchaseEvent(
  userId: string,
  overrides: Partial<RevenueCatEvent["event"]> = {},
): RevenueCatEvent {
  return {
    event: {
      type: "INITIAL_PURCHASE",
      id: randomUUID(),
      app_user_id: userId,
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
      const { handler, subRepo, user, academy } = setup();

      await handler.handleEvent(initialPurchaseEvent(user.id));

      const sub = await subRepo.findByAcademyId(academy.id);
      expect(sub).toBeDefined();
      expect(sub!.plan).toBe("pro");
      expect(sub!.status).toBe("active");
      expect(sub!.revenuecatAppUserId).toBe(user.id);
      expect(sub!.productId).toBe("tatame_pro_monthly");
      expect(sub!.originalTransactionId).toBe("1000000000000000");
      expect(sub!.store).toBe("app_store");
      expect(sub!.canceledAt).toBeNull();
      expect(sub!.currentPeriodEnd).toBeInstanceOf(Date);
    });

    it("enqueues the pro-activated email", async () => {
      const { handler, emailService, user } = setup();

      await handler.handleEvent(initialPurchaseEvent(user.id));

      expect(emailService.sendProActivated).toHaveBeenCalledOnce();
    });
  });

  describe("CANCELLATION", () => {
    it("sets canceledAt while keeping status=active and plan=pro", async () => {
      const { handler, subRepo, user, academy } = setup();
      await handler.handleEvent(initialPurchaseEvent(user.id));

      await handler.handleEvent({
        event: {
          type: "CANCELLATION",
          id: randomUUID(),
          app_user_id: user.id,
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
      const { handler, subRepo, user, academy } = setup();
      await handler.handleEvent(initialPurchaseEvent(user.id));
      await handler.handleEvent({
        event: {
          type: "CANCELLATION",
          id: randomUUID(),
          app_user_id: user.id,
          event_timestamp_ms: Date.now(),
        },
        api_version: "1.0",
      });

      await handler.handleEvent({
        event: {
          type: "UNCANCELLATION",
          id: randomUUID(),
          app_user_id: user.id,
          event_timestamp_ms: Date.now(),
        },
        api_version: "1.0",
      });

      const sub = await subRepo.findByAcademyId(academy.id);
      expect(sub!.canceledAt).toBeNull();
      expect(sub!.status).toBe("active");
    });
  });
});
