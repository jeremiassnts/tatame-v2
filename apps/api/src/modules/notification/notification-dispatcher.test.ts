import { describe, expect, it, vi } from "vitest";
import { NotificationDispatcher } from "./notification-dispatcher.js";

function setup() {
  const notificationService = {
    send: vi.fn().mockResolvedValue([]),
  };
  const userRepo = {
    findClerkIdsByInternalIds: vi.fn().mockResolvedValue(
      new Map([["uuid-1", "clerk_1"], ["uuid-2", "clerk_2"]]),
    ),
  };
  const membershipRepo = {
    findManagerClerkIdsByAcademy: vi.fn().mockResolvedValue(["clerk_mgr_1"]),
    findActiveStudentClerkIdsByAcademy: vi.fn().mockResolvedValue(["clerk_stu_1", "clerk_stu_2"]),
  };
  const dispatcher = new NotificationDispatcher(
    notificationService as any,
    userRepo as any,
    membershipRepo as any,
  );
  return { dispatcher, notificationService, userRepo, membershipRepo };
}

describe("NotificationDispatcher", () => {
  describe("notifyUsers", () => {
    it("resolves UUIDs to clerkUserIds and sends notification", async () => {
      const { dispatcher, notificationService, userRepo } = setup();
      await dispatcher.notifyUsers("payment_confirmed", ["uuid-1"], ["Plano Mensal"], { academyId: "acad-1" });
      expect(userRepo.findClerkIdsByInternalIds).toHaveBeenCalledWith(["uuid-1"]);
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientIds: ["clerk_1"],
          title: "Pagamento confirmado",
          category: "payment",
          academyId: "acad-1",
        }),
      );
    });

    it("skips when no clerkUserIds resolved", async () => {
      const { dispatcher, notificationService, userRepo } = setup();
      userRepo.findClerkIdsByInternalIds.mockResolvedValue(new Map());
      await dispatcher.notifyUsers("payment_confirmed", ["unknown"], ["Plan"]);
      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it("does not throw on error", async () => {
      const { dispatcher, notificationService } = setup();
      notificationService.send.mockRejectedValue(new Error("boom"));
      await expect(dispatcher.notifyUsers("payment_confirmed", ["uuid-1"], ["Plan"])).resolves.not.toThrow();
    });

    it("skips unknown template key", async () => {
      const { dispatcher, notificationService } = setup();
      await dispatcher.notifyUsers("unknown_key", ["uuid-1"], []);
      expect(notificationService.send).not.toHaveBeenCalled();
    });
  });

  describe("notifyAcademyManagers", () => {
    it("resolves managers and sends notification", async () => {
      const { dispatcher, notificationService, membershipRepo } = setup();
      await dispatcher.notifyAcademyManagers("new_member", "acad-1", ["João Silva"]);
      expect(membershipRepo.findManagerClerkIdsByAcademy).toHaveBeenCalledWith("acad-1");
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientIds: ["clerk_mgr_1"],
          title: "Novo aluno na academia",
          category: "new_member",
          academyId: "acad-1",
        }),
      );
    });

    it("skips when no managers found", async () => {
      const { dispatcher, notificationService, membershipRepo } = setup();
      membershipRepo.findManagerClerkIdsByAcademy.mockResolvedValue([]);
      await dispatcher.notifyAcademyManagers("new_member", "acad-1", ["João"]);
      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it("does not throw on error", async () => {
      const { dispatcher, notificationService } = setup();
      notificationService.send.mockRejectedValue(new Error("boom"));
      await expect(dispatcher.notifyAcademyManagers("new_member", "acad-1", ["João"])).resolves.not.toThrow();
    });
  });

  describe("notifyAcademyStudents", () => {
    it("resolves students and sends notification", async () => {
      const { dispatcher, notificationService, membershipRepo } = setup();
      await dispatcher.notifyAcademyStudents("class_updated", "acad-1", ["Jiu-Jitsu Avançado"]);
      expect(membershipRepo.findActiveStudentClerkIdsByAcademy).toHaveBeenCalledWith("acad-1");
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientIds: ["clerk_stu_1", "clerk_stu_2"],
          title: "Aula alterada",
          category: "class_change",
          academyId: "acad-1",
        }),
      );
    });

    it("skips when no students found", async () => {
      const { dispatcher, notificationService, membershipRepo } = setup();
      membershipRepo.findActiveStudentClerkIdsByAcademy.mockResolvedValue([]);
      await dispatcher.notifyAcademyStudents("class_deactivated", "acad-1", ["Aula"]);
      expect(notificationService.send).not.toHaveBeenCalled();
    });
  });
});
