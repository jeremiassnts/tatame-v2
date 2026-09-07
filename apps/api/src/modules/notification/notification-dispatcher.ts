import type { NotificationService } from "./notification.service.js";
import type { IUserRepository } from "../user/user.repository.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import { getTemplate, categoryForTemplateKey } from "./notification-templates.js";

export class NotificationDispatcher {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly userRepo: IUserRepository,
    private readonly membershipRepo: IMembershipRepository,
  ) {}

  async notifyUsers(
    templateKey: string,
    userIds: string[],
    templateArgs: string[],
    opts?: { academyId?: string; data?: Record<string, unknown> },
  ): Promise<void> {
    try {
      const template = getTemplate(templateKey);
      if (!template) {
        console.warn("[dispatcher] Unknown template key", { templateKey });
        return;
      }
      const clerkIdMap = await this.userRepo.findClerkIdsByInternalIds(userIds);
      const recipientIds = userIds
        .map((id) => clerkIdMap.get(id))
        .filter((id): id is string => id !== undefined);
      if (recipientIds.length === 0) return;
      await this.notificationService.send({
        recipientIds,
        title: template.title,
        body: template.body(...templateArgs),
        category: categoryForTemplateKey(templateKey),
        academyId: opts?.academyId,
        data: opts?.data,
      });
    } catch (err) {
      console.error("[dispatcher] Failed to send notification", { err, templateKey });
    }
  }

  async notifyAcademyManagers(
    templateKey: string,
    academyId: string,
    templateArgs: string[],
    opts?: { data?: Record<string, unknown> },
  ): Promise<void> {
    try {
      const template = getTemplate(templateKey);
      if (!template) {
        console.warn("[dispatcher] Unknown template key", { templateKey });
        return;
      }
      const recipientIds = await this.membershipRepo.findManagerClerkIdsByAcademy(academyId);
      if (recipientIds.length === 0) return;
      await this.notificationService.send({
        recipientIds,
        title: template.title,
        body: template.body(...templateArgs),
        category: categoryForTemplateKey(templateKey),
        academyId,
        data: opts?.data,
      });
    } catch (err) {
      console.error("[dispatcher] Failed to send notification to managers", { err, templateKey });
    }
  }

  async notifyAcademyStudents(
    templateKey: string,
    academyId: string,
    templateArgs: string[],
    opts?: { data?: Record<string, unknown> },
  ): Promise<void> {
    try {
      const template = getTemplate(templateKey);
      if (!template) {
        console.warn("[dispatcher] Unknown template key", { templateKey });
        return;
      }
      const recipientIds = await this.membershipRepo.findActiveStudentClerkIdsByAcademy(academyId);
      if (recipientIds.length === 0) return;
      await this.notificationService.send({
        recipientIds,
        title: template.title,
        body: template.body(...templateArgs),
        category: categoryForTemplateKey(templateKey),
        academyId,
        data: opts?.data,
      });
    } catch (err) {
      console.error("[dispatcher] Failed to send notification to students", { err, templateKey });
    }
  }
}
