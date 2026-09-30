import type { InferSelectModel } from "drizzle-orm";
import type { checkins } from "@tatame/db";

export type CheckinRow = InferSelectModel<typeof checkins>;

export type CheckinHistoryItem = {
  id: string;
  className: string;
  date: string;
  startTime: string;
};

/**
 * A dependent's check-in row carries the **guardian's** `user_id` alongside its
 * `dependent_id`; only `dependent_id IS NULL` marks a row as the account
 * holder's own. Every `...ByUser...` method below is therefore scoped to the
 * account holder's own check-ins — without that clause a parent's weekly
 * allowance, history and engagement all absorb their children's training.
 */
export interface ICheckinRepository {
  countByClassAndDate(classId: string, sessionDate: string): Promise<number>;

  /** The account holder's own check-ins that week — never a dependent's. */
  countByUserAndWeek(userId: string, weekReference: string): Promise<number>;

  countByDependentAndWeek(dependentId: string, weekReference: string): Promise<number>;

  insert(data: {
    classId: string;
    userId: string;
    date: string;
    weekReference: string;
    dependentId?: string;
  }): Promise<CheckinRow>;

  /** The account holder's own history — never a dependent's. */
  findByUserWithClass(
    userId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<CheckinHistoryItem[]>;

  findByDependentWithClass(
    dependentId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<CheckinHistoryItem[]>;

  /**
   * Lifetime total for the milestone notifications. Own check-ins only: a
   * parent is not congratulated for sessions their child attended (TAT-181).
   */
  countTotalByUser(userId: string): Promise<number>;

  /** Per-user totals for the weekly summary — own check-ins only. */
  getWeeklyCheckinSummaries(weekReference: string): Promise<{ userId: string; count: number }[]>;

  /**
   * Users whose most recent **own** check-in predates `beforeDate`. Taking a
   * dependent to class does not count as the guardian having trained.
   */
  findInactiveUserIds(beforeDate: string): Promise<string[]>;
}
