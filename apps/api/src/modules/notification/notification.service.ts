import { HttpError } from "../../lib/http-error.js";
import type { INotificationRepository, NotificationRow } from "./notification.repository.js";
import type { IPushTokenRepository } from "../push-token/push-token.repository.js";
import type { INotificationPreferencesRepository } from "./notification-preferences.repository.js";
import type { NotificationJobData } from "./notification.queue.js";
import { log } from "../../telemetry/logger.js";

export class NotificationService {
  constructor(
    private readonly notificationRepo: INotificationRepository,
    private readonly pushTokenRepo: IPushTokenRepository,
    private readonly queue: { add(name: string, data: NotificationJobData): Promise<unknown> } | null,
    private readonly prefsRepo?: INotificationPreferencesRepository,
  ) {}

  async send(opts: {
    recipientIds: string[];
    title: string;
    body: string;
    category: NotificationRow["category"];
    data?: Record<string, unknown>;
    academyId?: string;
  }): Promise<NotificationRow[]> {
    const rows = await this.notificationRepo.createMany(
      opts.recipientIds.map((recipientId) => ({
        recipientId,
        title: opts.title,
        body: opts.body,
        category: opts.category,
        data: opts.data ?? null,
        academyId: opts.academyId ?? null,
      })),
    );

    for (const row of rows) {
      try {
        if (this.prefsRepo) {
          const pushEnabled = await this.prefsRepo.isPushEnabled(row.recipientId);
          if (!pushEnabled) continue;
        }

        const tokens = await this.pushTokenRepo.findByUserId(row.recipientId);
        if (tokens.length === 0) continue;

        for (const tokenRow of tokens) {
          if (!this.queue) {
            log.warn("no queue available, skipping push delivery", {
              component: "notification",
            });
            continue;
          }
          await this.queue.add("push-send", {
            notificationId: row.id,
            recipientId: row.recipientId,
            expoPushToken: tokenRow.token,
            title: opts.title,
            body: opts.body,
            data: opts.data,
          });
        }

        await this.notificationRepo.updateStatus(row.id, "queued");
      } catch (err) {
        log.error("failed to enqueue push", {
          component: "notification",
          err,
          notificationId: row.id,
        });
      }
    }

    return rows;
  }

  async listForUser(recipientId: string, cursor?: string, limit = 20) {
    return this.notificationRepo.listByRecipient(recipientId, { cursor, limit });
  }

  async getUnreadCount(recipientId: string) {
    return this.notificationRepo.countUnread(recipientId);
  }

  async markAsRead(id: string, recipientId: string) {
    const updated = await this.notificationRepo.markAsRead(id, recipientId);
    if (!updated) throw new HttpError(404, "Notification not found");
  }

  async markAllAsRead(recipientId: string) {
    return this.notificationRepo.markAllAsRead(recipientId);
  }

  async deleteNotification(id: string, recipientId: string) {
    const deleted = await this.notificationRepo.deleteById(id, recipientId);
    if (!deleted) throw new HttpError(404, "Notification not found");
  }
}
