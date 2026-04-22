import { randomUUID } from "node:crypto";
import type {
  INotificationRepository,
  NotificationRow,
} from "./notification.repository.js";

export class InMemoryNotificationRepository implements INotificationRepository {
  constructor(public readonly rows: NotificationRow[] = []) {}

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
    const now = new Date();
    const created = items.map((item) => {
      const row: NotificationRow = {
        id: randomUUID(),
        recipientId: item.recipientId,
        title: item.title,
        body: item.body,
        category: item.category,
        data: item.data ?? null,
        readAt: null,
        sentAt: null,
        status: "pending",
        academyId: item.academyId ?? null,
        createdAt: now,
        updatedAt: now,
      };
      this.rows.push(row);
      return row;
    });
    return created;
  }

  async updateStatus(
    id: string,
    status: NotificationRow["status"],
    sentAt?: Date,
  ): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (row) {
      row.status = status;
      if (sentAt) row.sentAt = sentAt;
      row.updatedAt = new Date();
    }
  }
}
