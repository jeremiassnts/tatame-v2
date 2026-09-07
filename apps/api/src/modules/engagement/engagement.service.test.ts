import { describe, expect, it, vi } from "vitest";
import { EngagementService } from "./engagement.service.js";
import { InMemoryMilestoneRepository } from "./milestone.repository.in-memory.js";

function setup() {
  const notificationService = { send: vi.fn().mockResolvedValue([]) };
  const notificationRepo = { countTodayByRecipientAndCategories: vi.fn().mockResolvedValue(0) };
  const checkinRepo = {
    getWeeklyCheckinSummaries: vi.fn().mockResolvedValue([]),
    findInactiveUserIds: vi.fn().mockResolvedValue([]),
    countTotalByUser: vi.fn().mockResolvedValue(0),
  };
  const userRepo = { findClerkIdByInternalId: vi.fn().mockResolvedValue("clerk_user_1") };
  const membershipRepo = {
    findActiveByUser: vi.fn().mockResolvedValue({ id: "m1", status: "active", role: "student", academyId: "a1" }),
  };
  const milestoneRepo = new InMemoryMilestoneRepository();

  const service = new EngagementService(
    notificationService as any, notificationRepo as any, checkinRepo as any,
    userRepo as any, membershipRepo as any, milestoneRepo,
  );
  return { service, notificationService, notificationRepo, checkinRepo, userRepo, membershipRepo, milestoneRepo };
}

describe("EngagementService", () => {
  describe("processWeeklySummary", () => {
    it("sends summary to users who trained", async () => {
      const { service, checkinRepo, notificationService } = setup();
      checkinRepo.getWeeklyCheckinSummaries.mockResolvedValue([{ userId: "u1", count: 3 }, { userId: "u2", count: 1 }]);
      const sent = await service.processWeeklySummary();
      expect(sent).toBe(2);
      expect(notificationService.send).toHaveBeenCalledTimes(2);
    });

    it("skips users with no clerkId", async () => {
      const { service, checkinRepo, userRepo, notificationService } = setup();
      checkinRepo.getWeeklyCheckinSummaries.mockResolvedValue([{ userId: "u1", count: 2 }]);
      userRepo.findClerkIdByInternalId.mockResolvedValue(undefined);
      expect(await service.processWeeklySummary()).toBe(0);
      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it("respects rate limit", async () => {
      const { service, checkinRepo, notificationRepo, notificationService } = setup();
      checkinRepo.getWeeklyCheckinSummaries.mockResolvedValue([{ userId: "u1", count: 2 }]);
      notificationRepo.countTodayByRecipientAndCategories.mockResolvedValue(2);
      expect(await service.processWeeklySummary()).toBe(0);
      expect(notificationService.send).not.toHaveBeenCalled();
    });
  });

  describe("processInactivityNudge", () => {
    it("sends nudge to inactive users with active membership", async () => {
      const { service, checkinRepo, notificationService } = setup();
      checkinRepo.findInactiveUserIds.mockResolvedValue(["u1"]);
      expect(await service.processInactivityNudge()).toBe(1);
      expect(notificationService.send).toHaveBeenCalledWith(expect.objectContaining({ title: "Sentimos sua falta!" }));
    });

    it("skips users without active membership", async () => {
      const { service, checkinRepo, membershipRepo } = setup();
      checkinRepo.findInactiveUserIds.mockResolvedValue(["u1"]);
      membershipRepo.findActiveByUser.mockResolvedValue(null);
      expect(await service.processInactivityNudge()).toBe(0);
    });
  });

  describe("checkMilestone", () => {
    it("sends milestone notification at 100 checkins", async () => {
      const { service, checkinRepo, notificationService } = setup();
      checkinRepo.countTotalByUser.mockResolvedValue(100);
      await service.checkMilestone("u1");
      expect(notificationService.send).toHaveBeenCalledWith(expect.objectContaining({ title: "Marco alcançado! 🥋" }));
    });

    it("skips non-milestone counts", async () => {
      const { service, checkinRepo, notificationService } = setup();
      checkinRepo.countTotalByUser.mockResolvedValue(99);
      await service.checkMilestone("u1");
      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it("deduplicates milestone notifications", async () => {
      const { service, checkinRepo, milestoneRepo, notificationService } = setup();
      checkinRepo.countTotalByUser.mockResolvedValue(100);
      await milestoneRepo.record("u1", 100);
      await service.checkMilestone("u1");
      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it("does not throw on error", async () => {
      const { service, checkinRepo, notificationService } = setup();
      checkinRepo.countTotalByUser.mockResolvedValue(100);
      notificationService.send.mockRejectedValue(new Error("boom"));
      await expect(service.checkMilestone("u1")).resolves.not.toThrow();
    });
  });
});
