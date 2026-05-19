import { HttpError } from "../../lib/http-error.js";
import type {
  IAnnouncementRepository,
  AnnouncementRow,
  AnnouncementWithAuthor,
} from "./announcement.repository.js";

export class AnnouncementService {
  constructor(private readonly repo: IAnnouncementRepository) {}

  async create(data: {
    academyId: string;
    authorId: string;
    title: string;
    body: string;
    imageUrl?: string | null;
  }): Promise<AnnouncementRow> {
    return this.repo.create(data);
  }

  async getById(id: string): Promise<AnnouncementWithAuthor> {
    const row = await this.repo.findById(id);
    if (!row) throw new HttpError(404, "Announcement not found");
    return row;
  }

  async listByAcademy(
    academyId: string,
    cursor?: string,
    limit?: number,
  ): Promise<{ items: AnnouncementWithAuthor[]; nextCursor: string | null }> {
    return this.repo.findByAcademy(academyId, cursor, limit);
  }

  async countByAcademy(academyId: string): Promise<number> {
    return this.repo.countByAcademy(academyId);
  }

  async update(
    id: string,
    academyId: string,
    data: { title?: string; body?: string; imageUrl?: string | null },
  ): Promise<AnnouncementRow> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new HttpError(404, "Announcement not found");
    if (existing.academyId !== academyId)
      throw new HttpError(403, "Announcement does not belong to this academy");
    const updated = await this.repo.update(id, data);
    if (!updated) throw new HttpError(404, "Announcement not found");
    return updated;
  }

  async delete(id: string, academyId: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new HttpError(404, "Announcement not found");
    if (existing.academyId !== academyId)
      throw new HttpError(403, "Announcement does not belong to this academy");
    await this.repo.delete(id);
  }
}
