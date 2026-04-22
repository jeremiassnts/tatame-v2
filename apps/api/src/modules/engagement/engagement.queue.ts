import { Queue } from "bullmq";

export type EngagementJobName = "weekly-summary" | "inactivity-nudge";

let engagementQueue: Queue | null = null;

export function getEngagementQueue(redisUrl: string): Queue {
  if (!engagementQueue) {
    engagementQueue = new Queue("engagement", {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return engagementQueue;
}

/** BRT = UTC-3 → 09:00 BRT = 12:00 UTC */
export async function registerEngagementJobs(redisUrl: string): Promise<void> {
  const queue = getEngagementQueue(redisUrl);
  await queue.add("weekly-summary", {}, { repeat: { pattern: "0 12 * * 1" }, jobId: "weekly-summary-repeatable" });
  await queue.add("inactivity-nudge", {}, { repeat: { pattern: "0 12 * * 0" }, jobId: "inactivity-nudge-repeatable" });
}

export async function closeEngagementQueue(): Promise<void> {
  if (engagementQueue) { await engagementQueue.close(); engagementQueue = null; }
}
