import { and, count, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { notifications, customNotificationSends, type Database } from "@tatame/db";
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

  async listByRecipient(
    recipientId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: NotificationRow[]; nextCursor: string | null }> {
    const fetchLimit = opts.limit + 1;

    let cursorCondition;
    if (opts.cursor) {
      const decoded = JSON.parse(
        Buffer.from(opts.cursor, "base64").toString("utf8"),
      ) as { createdAt: string; id: string };
      const cursorCreatedAt = new Date(decoded.createdAt);
      const cursorId = decoded.id;
      // (createdAt, id) < (cursorCreatedAt, cursorId) DESC order
      cursorCondition = or(
        lt(notifications.createdAt, cursorCreatedAt),
        and(
          eq(notifications.createdAt, cursorCreatedAt),
          lt(notifications.id, cursorId),
        ),
      );
    }

    const rows = await this.db
      .select()
      .from(notifications)
      .where(
        cursorCondition
          ? and(eq(notifications.recipientId, recipientId), cursorCondition)
          : eq(notifications.recipientId, recipientId),
      )
      .orderBy(
        sql`${notifications.createdAt} DESC`,
        sql`${notifications.id} DESC`,
      )
      .limit(fetchLimit);

    const hasMore = rows.length > opts.limit;
    const items = hasMore ? rows.slice(0, opts.limit) : rows;

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
    const [result] = await this.db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          isNull(notifications.readAt),
        ),
      );
    return result?.count ?? 0;
  }

  async markAsRead(id: string, recipientId: string): Promise<boolean> {
    const result = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.recipientId, recipientId),
          isNull(notifications.readAt),
        ),
      )
      .returning({ id: notifications.id });
    return result.length > 0;
  }

  async markAllAsRead(recipientId: string): Promise<number> {
    const result = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          isNull(notifications.readAt),
        ),
      )
      .returning({ id: notifications.id });
    return result.length;
  }

  async deleteById(id: string, recipientId: string): Promise<boolean> {
    const result = await this.db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.recipientId, recipientId),
        ),
      )
      .returning({ id: notifications.id });
    return result.length > 0;
  }

  async countTodayByRecipientAndCategories(
    recipientId: string,
    categories: NotificationRow["category"][],
  ): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [row] = await this.db
      .select({ c: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          inArray(notifications.category, categories),
          gte(notifications.createdAt, todayStart),
        ),
      );
    return Number(row?.c ?? 0);
  }

  async countCustomSendsToday(academyId: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const [row] = await this.db
      .select({ c: count() })
      .from(customNotificationSends)
      .where(
        and(
          eq(customNotificationSends.academyId, academyId),
          gte(customNotificationSends.createdAt, todayStart),
        ),
      );
    return Number(row?.c ?? 0);
  }

  async createCustomSend(data: {
    academyId: string;
    senderId: string;
  }): Promise<void> {
    await this.db.insert(customNotificationSends).values({
      academyId: data.academyId,
      senderId: data.senderId,
    });
  }
}
