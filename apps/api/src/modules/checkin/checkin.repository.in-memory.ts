import { randomUUID } from "node:crypto";
import type {
  CheckinHistoryItem,
  CheckinRow,
  ICheckinRepository,
} from "./checkin.repository.js";

export class InMemoryCheckinRepository implements ICheckinRepository {
  constructor(private readonly rows: CheckinRow[] = []) {}

  async countByClassAndDate(
    classId: string,
    sessionDate: string,
  ): Promise<number> {
    return this.rows.filter(
      (r) => r.classId === classId && r.date === sessionDate,
    ).length;
  }

  async countByUserAndWeek(
    userId: string,
    weekReference: string,
  ): Promise<number> {
    return this.rows.filter(
      (r) => r.userId === userId && r.weekReference === weekReference,
    ).length;
  }

  async countByDependentAndWeek(
    dependentId: string,
    weekReference: string,
  ): Promise<number> {
    return this.rows.filter(
      (r) => r.dependentId === dependentId && r.weekReference === weekReference,
    ).length;
  }

  async insert(data: {
    classId: string;
    userId: string;
    date: string;
    weekReference: string;
    dependentId?: string;
  }): Promise<CheckinRow> {
    const dup = this.rows.some(
      (r) =>
        r.userId === data.userId &&
        r.classId === data.classId &&
        r.date === data.date,
    );
    if (dup) {
      const err = new Error("duplicate checkin");
      (err as NodeJS.ErrnoException).code = "23505";
      throw err;
    }
    const t = new Date();
    const row: CheckinRow = {
      id: randomUUID(),
      classId: data.classId,
      userId: data.userId,
      date: data.date,
      weekReference: data.weekReference,
      checkedInAt: t,
      dependentId: data.dependentId ?? null,
    };
    this.rows.push(row);
    return row;
  }

  async findByUserWithClass(
    _userId: string,
    _opts: { cursor?: string; limit: number },
  ): Promise<CheckinHistoryItem[]> {
    return [];
  }

  async countTotalByUser(userId: string): Promise<number> {
    return this.rows.filter((r) => r.userId === userId).length;
  }

  async getWeeklyCheckinSummaries(weekReference: string): Promise<{ userId: string; count: number }[]> {
    const counts = new Map<string, number>();
    for (const r of this.rows.filter((r) => r.weekReference === weekReference)) {
      counts.set(r.userId, (counts.get(r.userId) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([userId, count]) => ({ userId, count }));
  }

  async findInactiveUserIds(_beforeDate: string): Promise<string[]> {
    return [];
  }
}
