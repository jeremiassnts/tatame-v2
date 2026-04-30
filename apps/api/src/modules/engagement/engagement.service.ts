import { logger } from "../../lib/logger.js";
import type { NotificationService } from "../notification/notification.service.js";
import type { INotificationRepository } from "../notification/notification.repository.js";
import type { ICheckinRepository } from "../checkin/checkin.repository.js";
import type { IUserRepository } from "../user/user.repository.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { IMilestoneRepository } from "./milestone.repository.js";
import { getTemplate, categoryForTemplateKey } from "../notification/notification-templates.js";

const ENGAGEMENT_CATEGORIES = ["weekly_summary", "inactivity", "milestone", "streak"] as const;
const MAX_ENGAGEMENT_PER_DAY = 2;
const MILESTONES = [50, 100, 200, 500, 1000];

export class EngagementService {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationRepo: INotificationRepository,
    private readonly checkinRepo: ICheckinRepository,
    private readonly userRepo: IUserRepository,
    private readonly membershipRepo: IMembershipRepository,
    private readonly milestoneRepo: IMilestoneRepository,
  ) {}

  async processWeeklySummary(): Promise<number> {
    const lastMonday = this.getLastMonday();
    const summaries = await this.checkinRepo.getWeeklyCheckinSummaries(lastMonday);
    let sent = 0;

    for (const { userId, count } of summaries) {
      try {
        const clerkId = await this.userRepo.findClerkIdByInternalId(userId);
        if (!clerkId) continue;
        if (await this.isRateLimited(clerkId)) continue;

        const template = getTemplate("weekly_summary")!;
        await this.notificationService.send({
          recipientIds: [clerkId],
          title: template.title,
          body: template.body(String(count)),
          category: categoryForTemplateKey("weekly_summary"),
        });
        sent++;
      } catch (err) {
        logger.error({ err, userId }, "[engagement] Failed to send weekly summary");
      }
    }
    logger.info({ sent, total: summaries.length }, "[engagement] Weekly summary processed");
    return sent;
  }

  async processInactivityNudge(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 14);
    const cutoff = cutoffDate.toISOString().slice(0, 10);

    const inactiveUserIds = await this.checkinRepo.findInactiveUserIds(cutoff);
    let sent = 0;

    for (const userId of inactiveUserIds) {
      try {
        const membership = await this.membershipRepo.findActiveByUser(userId);
        if (!membership || membership.status !== "active") continue;

        const clerkId = await this.userRepo.findClerkIdByInternalId(userId);
        if (!clerkId) continue;
        if (await this.isRateLimited(clerkId)) continue;

        const template = getTemplate("inactivity_nudge")!;
        await this.notificationService.send({
          recipientIds: [clerkId],
          title: template.title,
          body: template.body(),
          category: categoryForTemplateKey("inactivity_nudge"),
        });
        sent++;
      } catch (err) {
        logger.error({ err, userId }, "[engagement] Failed to send inactivity nudge");
      }
    }
    logger.info({ sent, total: inactiveUserIds.length }, "[engagement] Inactivity nudge processed");
    return sent;
  }

  async checkMilestone(userId: string): Promise<void> {
    try {
      const totalCheckins = await this.checkinRepo.countTotalByUser(userId);
      if (!MILESTONES.includes(totalCheckins)) return;

      const alreadySent = await this.milestoneRepo.exists(userId, totalCheckins);
      if (alreadySent) return;

      const clerkId = await this.userRepo.findClerkIdByInternalId(userId);
      if (!clerkId) return;
      if (await this.isRateLimited(clerkId)) return;

      const template = getTemplate("milestone")!;
      await this.notificationService.send({
        recipientIds: [clerkId],
        title: template.title,
        body: template.body(String(totalCheckins)),
        category: categoryForTemplateKey("milestone"),
      });
      await this.milestoneRepo.record(userId, totalCheckins);
    } catch (err) {
      logger.error({ err, userId }, "[engagement] Failed to check milestone");
    }
  }

  private async isRateLimited(clerkId: string): Promise<boolean> {
    const todayCount = await this.notificationRepo.countTodayByRecipientAndCategories(
      clerkId,
      [...ENGAGEMENT_CATEGORIES] as any,
    );
    return todayCount >= MAX_ENGAGEMENT_PER_DAY;
  }

  private getLastMonday(): string {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    const lastMonday = new Date(now);
    lastMonday.setUTCDate(now.getUTCDate() - diff - 7);
    return lastMonday.toISOString().slice(0, 10);
  }
}
