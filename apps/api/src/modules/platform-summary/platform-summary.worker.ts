import { loadEnv } from "@tatame/config";
import { Worker, type Job } from "bullmq";
import { getDb } from "../../lib/db.js";
import { log } from "../../telemetry/logger.js";
import { getEmailQueue } from "../email/email.queue.js";
import { EmailService } from "../email/email.service.js";
import type {
  DailySummaryJobData,
  PlatformSummaryJobName,
} from "./platform-summary.queue.js";
import { PostgresPlatformSummaryRepository } from "./platform-summary.repository.postgres.js";
import {
  PlatformSummaryService,
  previousBrtDate,
} from "./platform-summary.service.js";

function buildPlatformSummaryService(): PlatformSummaryService {
  const env = loadEnv();
  const emailService = env.REDIS_URL
    ? new EmailService(getEmailQueue(env.REDIS_URL))
    : null;
  return new PlatformSummaryService(
    new PostgresPlatformSummaryRepository(getDb()),
    emailService,
    env.ADMIN_EMAIL,
  );
}

async function processPlatformSummaryJob(job: Job): Promise<void> {
  const jobName = job.name as PlatformSummaryJobName;
  if (jobName !== "daily-summary") {
    log.warn("unknown job name", { component: "platform-summary", jobName });
    return;
  }

  // The cron fires at 07:00 BRT, when "today" is seven hours old and nearly
  // empty — the day worth reporting is the one that just ended. An explicit
  // `date` re-runs any past day.
  const { date } = (job.data ?? {}) as DailySummaryJobData;
  const referenceDate = date ?? previousBrtDate(new Date());

  const service = buildPlatformSummaryService();
  await service.sendDailySummary(referenceDate);
}

let platformSummaryWorker: Worker | null = null;

export function startPlatformSummaryWorker(redisUrl: string): Worker {
  if (platformSummaryWorker) return platformSummaryWorker;

  platformSummaryWorker = new Worker(
    "platform-summary",
    processPlatformSummaryJob,
    { connection: { url: redisUrl }, concurrency: 1 },
  );

  platformSummaryWorker.on("failed", (job, err) => {
    log.error("job failed", {
      component: "platform-summary",
      jobName: job?.name,
      jobId: job?.id,
      err,
    });
  });

  return platformSummaryWorker;
}

export async function closePlatformSummaryWorker(): Promise<void> {
  if (platformSummaryWorker) {
    await platformSummaryWorker.close();
    platformSummaryWorker = null;
  }
}
