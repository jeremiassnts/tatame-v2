import type { InferSelectModel } from "drizzle-orm";
import type { notifications } from "@tatame/db";

export type NotificationRow = InferSelectModel<typeof notifications>;

export interface INotificationRepository {
  createMany(
    items: {
      recipientId: string;
      title: string;
      body: string;
      category: NotificationRow["category"];
      data?: Record<string, unknown> | null;
      academyId?: string | null;
    }[],
  ): Promise<NotificationRow[]>;

  updateStatus(
    id: string,
    status: NotificationRow["status"],
    sentAt?: Date,
  ): Promise<void>;

  listByRecipient(
    recipientId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: NotificationRow[]; nextCursor: string | null }>;

  countUnread(recipientId: string): Promise<number>;

  markAsRead(id: string, recipientId: string): Promise<boolean>;

  markAllAsRead(recipientId: string): Promise<number>;

  deleteById(id: string, recipientId: string): Promise<boolean>;

  countTodayByRecipientAndCategories(
    recipientId: string,
    categories: NotificationRow["category"][],
  ): Promise<number>;
}
