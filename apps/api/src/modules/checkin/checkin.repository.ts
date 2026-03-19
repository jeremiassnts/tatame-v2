import type { InferSelectModel } from "drizzle-orm";
import type { checkins } from "@tatame/db";

export type CheckinRow = InferSelectModel<typeof checkins>;

export interface ICheckinRepository {
  countByClassAndDate(classId: string, sessionDate: string): Promise<number>;

  countByUserAndWeek(userId: string, weekReference: string): Promise<number>;

  insert(data: {
    classId: string;
    userId: string;
    date: string;
    weekReference: string;
  }): Promise<CheckinRow>;
}
