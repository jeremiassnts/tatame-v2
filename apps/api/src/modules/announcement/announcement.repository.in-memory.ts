import { randomUUID } from "node:crypto";
import type {
  IAnnouncementRepository,
  AnnouncementRow,
  AnnouncementWithAuthor,
} from "./announcement.repository.js";

export class InMemoryAnnouncementRepository
  implements IAnnouncementRepository
{
  rows: (AnnouncementRow & { authorName: string })[] = [];

  async create(data: {
    academyId: string;
    authorId: string;
    title: string;
    body: string;
    imageUrl?: string | null;
  }): Promise<AnnouncementRow> {
    const row: AnnouncementRow & { authorName: string } = {
      id: randomUUID(),
      academyId: data.academyId,
      authorId: data.authorId,
      title: data.title,
      body: data.body,
      imageUrl: data.imageUrl ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      authorName: "Test Author",
    };
    this.rows.push(row);
    return row;
  }

  async findById(id: string): Promise<AnnouncementWithAuthor | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  async findByAcademy(
    academyId: string,
    cursor?: string,
    limit = 20,
  ): Promise<{ items: AnnouncementWithAuthor[]; nextCursor: string | null }> {
    const filtered = this.rows
      .filter((r) => r.academyId === academyId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    let startIdx = 0;
    if (cursor) {
      const decoded = JSON.parse(
        Buffer.from(cursor, "base64").toString("utf8"),
      ) as { createdAt: string; id: string };
      const cursorTime = new Date(decoded.createdAt).getTime();
      startIdx = filtered.findIndex(
        (r) => r.createdAt.getTime() < cursorTime || r.id === decoded.id,
      );
      if (startIdx === -1) startIdx = filtered.length;
      else startIdx += 1;
    }

    const slice = filtered.slice(startIdx, startIdx + limit + 1);
    const hasMore = slice.length > limit;
    const items = hasMore ? slice.slice(0, limit) : slice;

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
    return this.rows.filter((r) => r.academyId === academyId).length;
  }

  async update(
    id: string,
    data: { title?: string; body?: string; imageUrl?: string | null },
  ): Promise<AnnouncementRow | null> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return null;
    if (data.title !== undefined) row.title = data.title;
    if (data.body !== undefined) row.body = data.body;
    if (data.imageUrl !== undefined) row.imageUrl = data.imageUrl;
    row.updatedAt = new Date();
    return row;
  }

  async delete(id: string): Promise<boolean> {
    const idx = this.rows.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.rows.splice(idx, 1);
    return true;
  }
}
