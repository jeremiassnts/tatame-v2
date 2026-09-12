import { Queue } from "bullmq";

export type PlatformSummaryJobName = "daily-summary";

/** Optional payload — omit `date` to summarise the BRT day that just ended. */
export type DailySummaryJobData = { date?: string };

let platformSummaryQueue: Queue | null = null;

export function getPlatformSummaryQueue(redisUrl: string): Queue {
  if (!platformSummaryQueue) {
    platformSummaryQueue = new Queue("platform-summary", {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 60 },
        removeOnFail: { count: 30 },
      },
    });
  }
  return platformSummaryQueue;
}

/** BRT = UTC-3 → 07:00 BRT = 10:00 UTC */
export async function registerPlatformSummaryJobs(
  redisUrl: string,
): Promise<void> {
  const queue = getPlatformSummaryQueue(redisUrl);
  await queue.add(
    "daily-summary",
    {},
    { repeat: { pattern: "0 10 * * *" }, jobId: "daily-summary-repeatable" },
  );
}

export async function closePlatformSummaryQueue(): Promise<void> {
  if (platformSummaryQueue) {
    await platformSummaryQueue.close();
    platformSummaryQueue = null;
  }
}
