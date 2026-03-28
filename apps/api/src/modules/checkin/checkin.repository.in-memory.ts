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

  async insert(data: {
    classId: string;
    userId: string;
    date: string;
    weekReference: string;
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
}
