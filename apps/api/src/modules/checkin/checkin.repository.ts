import type { InferSelectModel } from "drizzle-orm";
import type { checkins } from "@tatame/db";

export type CheckinRow = InferSelectModel<typeof checkins>;

export type CheckinHistoryItem = {
  id: string;
  className: string;
  date: string;
  startTime: string;
};

export interface ICheckinRepository {
  countByClassAndDate(classId: string, sessionDate: string): Promise<number>;

  countByUserAndWeek(userId: string, weekReference: string): Promise<number>;

  insert(data: {
    classId: string;
    userId: string;
    date: string;
    weekReference: string;
  }): Promise<CheckinRow>;

  findByUserWithClass(
    userId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<CheckinHistoryItem[]>;
}
