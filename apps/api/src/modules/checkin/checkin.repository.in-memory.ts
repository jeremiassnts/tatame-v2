import { randomUUID } from "node:crypto";
import type { ClassRow } from "../class/class.repository.js";
import type {
  CheckinHistoryItem,
  CheckinRow,
  ICheckinRepository,
} from "./checkin.repository.js";

export class InMemoryCheckinRepository implements ICheckinRepository {
  /**
   * `classes` backs the history joins. Callers that never read history can
   * leave it out, exactly as the Postgres `innerJoin` drops rows whose class
   * is missing.
   */
  constructor(
    private readonly rows: CheckinRow[] = [],
    private readonly classes: ClassRow[] = [],
  ) {}

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
    return this.ownRows().filter(
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
    // Mirrors the two partial unique indexes: one row per class and date for
    // the account holder, and one per class and date for each dependent. A
    // guardian may therefore take the same session as their child.
    const dependentId = data.dependentId ?? null;
    const dup = this.rows.some(
      (r) =>
        r.classId === data.classId &&
        r.date === data.date &&
        (dependentId === null
          ? r.dependentId === null && r.userId === data.userId
          : r.dependentId === dependentId),
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
      dependentId,
    };
    this.rows.push(row);
    return row;
  }

  async findByUserWithClass(
    userId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<CheckinHistoryItem[]> {
    return this.withClass(
      this.ownRows().filter((r) => r.userId === userId),
      opts,
    );
  }

  async findByDependentWithClass(
    dependentId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<CheckinHistoryItem[]> {
    return this.withClass(
      this.rows.filter((r) => r.dependentId === dependentId),
      opts,
    );
  }

  async countTotalByUser(userId: string): Promise<number> {
    return this.ownRows().filter((r) => r.userId === userId).length;
  }

  async getWeeklyCheckinSummaries(weekReference: string): Promise<{ userId: string; count: number }[]> {
    const counts = new Map<string, number>();
    for (const r of this.ownRows().filter(
      (r) => r.weekReference === weekReference,
    )) {
      counts.set(r.userId, (counts.get(r.userId) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([userId, count]) => ({ userId, count }));
  }

  async findInactiveUserIds(beforeDate: string): Promise<string[]> {
    const latest = new Map<string, string>();
    for (const r of this.ownRows()) {
      const seen = latest.get(r.userId);
      if (!seen || r.date > seen) latest.set(r.userId, r.date);
    }
    return Array.from(latest.entries())
      .filter(([, date]) => date < beforeDate)
      .map(([userId]) => userId);
  }

  /** Check-ins the account holder made for themselves. */
  private ownRows(): CheckinRow[] {
    return this.rows.filter((r) => r.dependentId === null);
  }

  private withClass(
    rows: CheckinRow[],
    opts: { cursor?: string; limit: number },
  ): CheckinHistoryItem[] {
    return rows
      .filter((r) => !opts.cursor || r.weekReference < opts.cursor)
      .sort((a, b) => b.date.localeCompare(a.date))
      .flatMap((r) => {
        const cls = this.classes.find((c) => c.id === r.classId);
        if (!cls) return [];
        return [
          {
            id: r.id,
            className: cls.name,
            date: r.date.slice(0, 10),
            startTime: cls.startTime,
          },
        ];
      })
      .slice(0, opts.limit);
  }
}
