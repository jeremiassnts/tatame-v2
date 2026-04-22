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

  async listByRecipient(
    recipientId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: NotificationRow[]; nextCursor: string | null }> {
    let filtered = this.rows
      .filter((r) => r.recipientId === recipientId)
      .sort((a, b) => {
        const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
      });

    if (opts.cursor) {
      const decoded = JSON.parse(
        Buffer.from(opts.cursor, "base64").toString("utf8"),
      ) as { createdAt: string; id: string };
      const cursorCreatedAt = new Date(decoded.createdAt).getTime();
      const cursorId = decoded.id;
      filtered = filtered.filter((r) => {
        const rowTime = r.createdAt.getTime();
        if (rowTime < cursorCreatedAt) return true;
        if (rowTime === cursorCreatedAt) return r.id < cursorId;
        return false;
      });
    }

    const fetchLimit = opts.limit + 1;
    const page = filtered.slice(0, fetchLimit);
    const hasMore = page.length > opts.limit;
    const items = hasMore ? page.slice(0, opts.limit) : page;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1]!;
      nextCursor = Buffer.from(
        JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }),
      ).toString("base64");
    }

    return { items, nextCursor };
  }

  async countUnread(recipientId: string): Promise<number> {
    return this.rows.filter(
      (r) => r.recipientId === recipientId && r.readAt === null,
    ).length;
  }

  async markAsRead(id: string, recipientId: string): Promise<boolean> {
    const row = this.rows.find(
      (r) => r.id === id && r.recipientId === recipientId && r.readAt === null,
    );
    if (!row) return false;
    row.readAt = new Date();
    row.updatedAt = new Date();
    return true;
  }

  async markAllAsRead(recipientId: string): Promise<number> {
    let count = 0;
    const now = new Date();
    for (const row of this.rows) {
      if (row.recipientId === recipientId && row.readAt === null) {
        row.readAt = now;
        row.updatedAt = now;
        count++;
      }
    }
    return count;
  }

  async deleteById(id: string, recipientId: string): Promise<boolean> {
    const index = this.rows.findIndex(
      (r) => r.id === id && r.recipientId === recipientId,
    );
    if (index === -1) return false;
    this.rows.splice(index, 1);
    return true;
  }
}
