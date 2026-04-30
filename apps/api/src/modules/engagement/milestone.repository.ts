export interface IMilestoneRepository {
  exists(userId: string, milestone: number): Promise<boolean>;
  record(userId: string, milestone: number): Promise<void>;
}
