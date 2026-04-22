import { describe, expect, it, vi } from "vitest";
import { InMemoryNotificationRepository } from "./notification.repository.in-memory.js";
import { InMemoryPushTokenRepository } from "../push-token/push-token.repository.in-memory.js";
import { NotificationService } from "./notification.service.js";
import { HttpError } from "../../lib/http-error.js";

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

  describe("listForUser", () => {
    it("returns paginated results for the recipient", async () => {
      const { service } = setup();
      // Send 3 notifications for clerk_a and 1 for clerk_b
      await service.send({
        recipientIds: ["clerk_a", "clerk_a", "clerk_b"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      const result = await service.listForUser("clerk_a", undefined, 10);
      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
      expect(result.items.every((n) => n.recipientId === "clerk_a")).toBe(true);
    });

    it("returns nextCursor when there are more items", async () => {
      const { service } = setup();
      await service.send({
        recipientIds: ["clerk_a", "clerk_a", "clerk_a"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      const result = await service.listForUser("clerk_a", undefined, 2);
      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).not.toBeNull();
    });

    it("uses cursor to fetch the next page", async () => {
      const { service } = setup();
      await service.send({
        recipientIds: ["clerk_a", "clerk_a", "clerk_a"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      const page1 = await service.listForUser("clerk_a", undefined, 2);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await service.listForUser("clerk_a", page1.nextCursor!, 2);
      expect(page2.items).toHaveLength(1);
      expect(page2.nextCursor).toBeNull();

      // No overlap between pages
      const page1Ids = new Set(page1.items.map((n) => n.id));
      for (const item of page2.items) {
        expect(page1Ids.has(item.id)).toBe(false);
      }
    });
  });

  describe("getUnreadCount", () => {
    it("returns the count of unread notifications", async () => {
      const { service } = setup();
      await service.send({
        recipientIds: ["clerk_a", "clerk_a", "clerk_a"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      const count = await service.getUnreadCount("clerk_a");
      expect(count).toBe(3);
    });

    it("returns 0 when all notifications are read", async () => {
      const { service } = setup();
      await service.send({
        recipientIds: ["clerk_a"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      await service.markAllAsRead("clerk_a");
      const count = await service.getUnreadCount("clerk_a");
      expect(count).toBe(0);
    });

    it("returns 0 for a user with no notifications", async () => {
      const { service } = setup();
      const count = await service.getUnreadCount("clerk_nobody");
      expect(count).toBe(0);
    });
  });

  describe("markAsRead", () => {
    it("marks a notification as read", async () => {
      const { service, notificationRepo } = setup();
      const [row] = await service.send({
        recipientIds: ["clerk_a"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      await service.markAsRead(row!.id, "clerk_a");
      const stored = notificationRepo.rows.find((r) => r.id === row!.id);
      expect(stored?.readAt).not.toBeNull();
    });

    it("throws 404 if notification not found or already read", async () => {
      const { service } = setup();
      await expect(service.markAsRead("nonexistent-id", "clerk_a")).rejects.toThrow(
        HttpError,
      );
      await expect(service.markAsRead("nonexistent-id", "clerk_a")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("does not mark notification of another user", async () => {
      const { service, notificationRepo } = setup();
      const [row] = await service.send({
        recipientIds: ["clerk_a"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      await expect(service.markAsRead(row!.id, "clerk_b")).rejects.toThrow(HttpError);
      const stored = notificationRepo.rows.find((r) => r.id === row!.id);
      expect(stored?.readAt).toBeNull();
    });
  });

  describe("markAllAsRead", () => {
    it("marks all unread notifications as read and returns count", async () => {
      const { service, notificationRepo } = setup();
      await service.send({
        recipientIds: ["clerk_a", "clerk_a", "clerk_a"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      const updated = await service.markAllAsRead("clerk_a");
      expect(updated).toBe(3);
      const unread = notificationRepo.rows.filter(
        (r) => r.recipientId === "clerk_a" && r.readAt === null,
      );
      expect(unread).toHaveLength(0);
    });

    it("returns 0 when there are no unread notifications", async () => {
      const { service } = setup();
      const updated = await service.markAllAsRead("clerk_a");
      expect(updated).toBe(0);
    });

    it("only marks the requesting user's notifications", async () => {
      const { service, notificationRepo } = setup();
      await service.send({
        recipientIds: ["clerk_a", "clerk_b"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      await service.markAllAsRead("clerk_a");
      const clerkBUnread = notificationRepo.rows.filter(
        (r) => r.recipientId === "clerk_b" && r.readAt === null,
      );
      expect(clerkBUnread).toHaveLength(1);
    });
  });

  describe("deleteNotification", () => {
    it("deletes a notification belonging to the user", async () => {
      const { service, notificationRepo } = setup();
      const [row] = await service.send({
        recipientIds: ["clerk_a"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      await service.deleteNotification(row!.id, "clerk_a");
      expect(notificationRepo.rows.find((r) => r.id === row!.id)).toBeUndefined();
    });

    it("throws 404 if notification does not exist", async () => {
      const { service } = setup();
      await expect(
        service.deleteNotification("nonexistent-id", "clerk_a"),
      ).rejects.toThrow(HttpError);
      await expect(
        service.deleteNotification("nonexistent-id", "clerk_a"),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("does not delete notification of another user", async () => {
      const { service, notificationRepo } = setup();
      const [row] = await service.send({
        recipientIds: ["clerk_a"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      await expect(
        service.deleteNotification(row!.id, "clerk_b"),
      ).rejects.toThrow(HttpError);
      expect(notificationRepo.rows.find((r) => r.id === row!.id)).toBeDefined();
    });
  });
});
