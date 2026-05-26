import type { InferSelectModel } from "drizzle-orm";
import type { announcements } from "@tatame/db";

export type AnnouncementRow = InferSelectModel<typeof announcements>;

export type AnnouncementWithAuthor = AnnouncementRow & {
  authorName: string;
};

export interface IAnnouncementRepository {
  create(data: {
    academyId: string;
    authorId: string;
    title: string;
    body: string;
    imageUrl?: string | null;
  }): Promise<AnnouncementRow>;

  findById(id: string): Promise<AnnouncementWithAuthor | null>;

  findByAcademy(
    academyId: string,
    cursor?: string,
    limit?: number,
  ): Promise<{ items: AnnouncementWithAuthor[]; nextCursor: string | null }>;

  countByAcademy(academyId: string): Promise<number>;

  update(
    id: string,
    data: { title?: string; body?: string; imageUrl?: string | null },
  ): Promise<AnnouncementRow | null>;

  delete(id: string): Promise<boolean>;
}
