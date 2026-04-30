import type { IMilestoneRepository } from "./milestone.repository.js";

export class InMemoryMilestoneRepository implements IMilestoneRepository {
  private readonly records: { userId: string; milestone: number }[] = [];

  async exists(userId: string, milestone: number): Promise<boolean> {
    return this.records.some((r) => r.userId === userId && r.milestone === milestone);
  }

  async record(userId: string, milestone: number): Promise<void> {
    if (!await this.exists(userId, milestone)) {
      this.records.push({ userId, milestone });
    }
  }
}
