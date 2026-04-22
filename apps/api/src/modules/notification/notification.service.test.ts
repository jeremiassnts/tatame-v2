import { describe, expect, it, vi } from "vitest";
import { InMemoryNotificationRepository } from "./notification.repository.in-memory.js";
import { InMemoryPushTokenRepository } from "../push-token/push-token.repository.in-memory.js";
import { NotificationService } from "./notification.service.js";

function setup() {
  const notificationRepo = new InMemoryNotificationRepository();
  const pushTokenRepo = new InMemoryPushTokenRepository();
  const mockQueue = { add: vi.fn().mockResolvedValue(undefined) };
  const service = new NotificationService(notificationRepo, pushTokenRepo, mockQueue);
  return { notificationRepo, pushTokenRepo, mockQueue, service };
}

describe("NotificationService", () => {
  describe("send", () => {
    it("creates notification records for each recipient", async () => {
      const { service, notificationRepo } = setup();
      const rows = await service.send({
        recipientIds: ["clerk_a", "clerk_b"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      expect(rows).toHaveLength(2);
      expect(notificationRepo.rows).toHaveLength(2);
      expect(rows[0]!.status).toBe("pending");
    });

    it("enqueues push jobs when recipient has a token", async () => {
      const { service, pushTokenRepo, mockQueue } = setup();
      await pushTokenRepo.upsert({
        userId: "clerk_a",
        token: "ExponentPushToken[abc]",
        platform: "ios",
        deviceId: "d1",
      });
      await service.send({
        recipientIds: ["clerk_a"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        "push-send",
        expect.objectContaining({
          expoPushToken: "ExponentPushToken[abc]",
          title: "Test",
          body: "Hello",
        }),
      );
    });

    it("updates status to queued after enqueuing", async () => {
      const { service, pushTokenRepo, notificationRepo } = setup();
      await pushTokenRepo.upsert({
        userId: "clerk_a",
        token: "ExponentPushToken[abc]",
        platform: "ios",
        deviceId: "d1",
      });
      await service.send({
        recipientIds: ["clerk_a"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      expect(notificationRepo.rows[0]!.status).toBe("queued");
    });

    it("skips push when recipient has no token (in-app only)", async () => {
      const { service, mockQueue, notificationRepo } = setup();
      await service.send({
        recipientIds: ["clerk_no_token"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(notificationRepo.rows).toHaveLength(1);
      expect(notificationRepo.rows[0]!.status).toBe("pending");
    });

    it("enqueues multiple jobs when user has multiple devices", async () => {
      const { service, pushTokenRepo, mockQueue } = setup();
      await pushTokenRepo.upsert({
        userId: "clerk_a",
        token: "ExponentPushToken[ios]",
        platform: "ios",
        deviceId: "d1",
      });
      await pushTokenRepo.upsert({
        userId: "clerk_a",
        token: "ExponentPushToken[android]",
        platform: "android",
        deviceId: "d2",
      });
      await service.send({
        recipientIds: ["clerk_a"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
    });

    it("does not throw when queue is null", async () => {
      const notificationRepo = new InMemoryNotificationRepository();
      const pushTokenRepo = new InMemoryPushTokenRepository();
      await pushTokenRepo.upsert({
        userId: "clerk_a",
        token: "ExponentPushToken[abc]",
        platform: "ios",
        deviceId: "d1",
      });
      const service = new NotificationService(notificationRepo, pushTokenRepo, null);
      await expect(
        service.send({
          recipientIds: ["clerk_a"],
          title: "Test",
          body: "Hello",
          category: "payment",
        }),
      ).resolves.not.toThrow();
    });
  });
});
