import { and, count, eq, lt, or, sql } from "drizzle-orm";
import { announcements, users, type Database } from "@tatame/db";
import type {
  IAnnouncementRepository,
  AnnouncementRow,
  AnnouncementWithAuthor,
} from "./announcement.repository.js";

export class PostgresAnnouncementRepository
  implements IAnnouncementRepository
{
  constructor(private readonly db: Database) {}

  async create(data: {
    academyId: string;
    authorId: string;
    title: string;
    body: string;
    imageUrl?: string | null;
  }): Promise<AnnouncementRow> {
    const [row] = await this.db
      .insert(announcements)
      .values({
        academyId: data.academyId,
        authorId: data.authorId,
        title: data.title,
        body: data.body,
        imageUrl: data.imageUrl ?? null,
      })
      .returning();
    return row!;
  }

  async findById(id: string): Promise<AnnouncementWithAuthor | null> {
    const [row] = await this.db
      .select({
        id: announcements.id,
        academyId: announcements.academyId,
        authorId: announcements.authorId,
        title: announcements.title,
        body: announcements.body,
        imageUrl: announcements.imageUrl,
        createdAt: announcements.createdAt,
        updatedAt: announcements.updatedAt,
        authorName: users.name,
      })
      .from(announcements)
      .innerJoin(users, eq(announcements.authorId, users.id))
      .where(eq(announcements.id, id));
    return row ?? null;
  }

  async findByAcademy(
    academyId: string,
    cursor?: string,
    limit = 20,
  ): Promise<{ items: AnnouncementWithAuthor[]; nextCursor: string | null }> {
    const fetchLimit = limit + 1;

    let cursorCondition;
    if (cursor) {
      const decoded = JSON.parse(
        Buffer.from(cursor, "base64").toString("utf8"),
      ) as { createdAt: string; id: string };
      const cursorCreatedAt = new Date(decoded.createdAt);
      const cursorId = decoded.id;
      cursorCondition = or(
        lt(announcements.createdAt, cursorCreatedAt),
        and(
          eq(announcements.createdAt, cursorCreatedAt),
          lt(announcements.id, cursorId),
        ),
      );
    }

    const rows = await this.db
      .select({
        id: announcements.id,
        academyId: announcements.academyId,
        authorId: announcements.authorId,
        title: announcements.title,
        body: announcements.body,
        imageUrl: announcements.imageUrl,
        createdAt: announcements.createdAt,
        updatedAt: announcements.updatedAt,
        authorName: users.name,
      })
      .from(announcements)
      .innerJoin(users, eq(announcements.authorId, users.id))
      .where(
        cursorCondition
          ? and(eq(announcements.academyId, academyId), cursorCondition)
          : eq(announcements.academyId, academyId),
      )
      .orderBy(
        sql`${announcements.createdAt} DESC`,
        sql`${announcements.id} DESC`,
      )
      .limit(fetchLimit);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1]!;
      nextCursor = Buffer.from(
        JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }),
      ).toString("base64");
    }

    return { items, nextCursor };
  }

  async countByAcademy(academyId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(announcements)
      .where(eq(announcements.academyId, academyId));
    return result?.count ?? 0;
  }

  async update(
    id: string,
    data: { title?: string; body?: string; imageUrl?: string | null },
  ): Promise<AnnouncementRow | null> {
    const [row] = await this.db
      .update(announcements)
      .set({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
      })
      .where(eq(announcements.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(announcements)
      .where(eq(announcements.id, id))
      .returning({ id: announcements.id });
    return result.length > 0;
  }
}
