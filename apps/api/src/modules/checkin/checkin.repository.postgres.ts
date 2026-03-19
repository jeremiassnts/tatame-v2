import { and, count, eq } from "drizzle-orm";
import { checkins, type Database } from "@tatame/db";
import type { CheckinRow, ICheckinRepository } from "./checkin.repository.js";

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
}
