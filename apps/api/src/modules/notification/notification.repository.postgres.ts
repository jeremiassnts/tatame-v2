import { eq } from "drizzle-orm";
import { notifications, type Database } from "@tatame/db";
import type {
  INotificationRepository,
  NotificationRow,
} from "./notification.repository.js";

export class PostgresNotificationRepository implements INotificationRepository {
  constructor(private readonly db: Database) {}

  async createMany(
    items: {
      recipientId: string;
      title: string;
      body: string;
      category: NotificationRow["category"];
      data?: Record<string, unknown> | null;
      academyId?: string | null;
    }[],
  ): Promise<NotificationRow[]> {
    if (items.length === 0) return [];
    return this.db
      .insert(notifications)
      .values(
        items.map((item) => ({
          recipientId: item.recipientId,
          title: item.title,
          body: item.body,
          category: item.category,
          data: item.data ?? null,
          academyId: item.academyId ?? null,
          status: "pending" as const,
        })),
      )
      .returning();
  }

  async updateStatus(
    id: string,
    status: NotificationRow["status"],
    sentAt?: Date,
  ): Promise<void> {
    await this.db
      .update(notifications)
      .set({
        status,
        ...(sentAt ? { sentAt } : {}),
      })
      .where(eq(notifications.id, id));
  }
}
