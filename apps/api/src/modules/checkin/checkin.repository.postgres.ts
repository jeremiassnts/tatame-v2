import { and, count, desc, eq, lt } from "drizzle-orm";
import { checkins, classes, type Database } from "@tatame/db";
import type {
  CheckinHistoryItem,
  CheckinRow,
  ICheckinRepository,
} from "./checkin.repository.js";

export class PostgresCheckinRepository implements ICheckinRepository {
  constructor(private readonly db: Database) {}

  async countByClassAndDate(
    classId: string,
    sessionDate: string,
  ): Promise<number> {
    const [row] = await this.db
      .select({ c: count() })
      .from(checkins)
      .where(
        and(eq(checkins.classId, classId), eq(checkins.date, sessionDate)),
      );
    return Number(row?.c ?? 0);
  }

  async countByUserAndWeek(
    userId: string,
    weekReference: string,
  ): Promise<number> {
    const [row] = await this.db
      .select({ c: count() })
      .from(checkins)
      .where(
        and(
          eq(checkins.userId, userId),
          eq(checkins.weekReference, weekReference),
        ),
      );
    return Number(row?.c ?? 0);
  }

  async insert(data: {
    classId: string;
    userId: string;
    date: string;
    weekReference: string;
  }): Promise<CheckinRow> {
    const [row] = await this.db
      .insert(checkins)
      .values({
        classId: data.classId,
        userId: data.userId,
        date: data.date,
        weekReference: data.weekReference,
      })
      .returning();
    if (!row) throw new Error("Failed to create check-in");
    return row;
  }

  async findByUserWithClass(
    userId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<CheckinHistoryItem[]> {
    const conditions = [eq(checkins.userId, userId)];
    if (opts.cursor) {
      conditions.push(lt(checkins.weekReference, opts.cursor));
    }

    const rows = await this.db
      .select({
        id: checkins.id,
        date: checkins.date,
        className: classes.name,
        startTime: classes.startTime,
      })
      .from(checkins)
      .innerJoin(classes, eq(checkins.classId, classes.id))
      .where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      .orderBy(desc(checkins.date))
      .limit(opts.limit);

    return rows.map((r) => ({
      id: r.id,
      className: r.className,
      date: r.date.slice(0, 10),
      startTime: r.startTime,
    }));
  }
}
