import { and, eq } from "drizzle-orm";
import { engagementMilestones, type Database } from "@tatame/db";
import type { IMilestoneRepository } from "./milestone.repository.js";

export class PostgresMilestoneRepository implements IMilestoneRepository {
  constructor(private readonly db: Database) {}

  async exists(userId: string, milestone: number): Promise<boolean> {
    const [row] = await this.db
      .select({ id: engagementMilestones.id })
      .from(engagementMilestones)
      .where(and(eq(engagementMilestones.userId, userId), eq(engagementMilestones.milestone, milestone)))
      .limit(1);
    return !!row;
  }

  async record(userId: string, milestone: number): Promise<void> {
    await this.db.insert(engagementMilestones).values({ userId, milestone }).onConflictDoNothing();
  }
}
