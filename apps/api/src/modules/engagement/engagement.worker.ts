import { Worker, type Job } from "bullmq";
import { getDb } from "../../lib/db.js";
import { loadEnv } from "@tatame/config";
import { PostgresNotificationRepository } from "../notification/notification.repository.postgres.js";
import { PostgresPushTokenRepository } from "../push-token/push-token.repository.postgres.js";
import { getNotificationQueue } from "../notification/notification.queue.js";
import { NotificationService } from "../notification/notification.service.js";
import { PostgresCheckinRepository } from "../checkin/checkin.repository.postgres.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { PostgresMilestoneRepository } from "./milestone.repository.postgres.js";
import { EngagementService } from "./engagement.service.js";
import type { EngagementJobName } from "./engagement.queue.js";
import { log } from "../../telemetry/logger.js";

function buildEngagementService(): EngagementService {
  const db = getDb();
  const env = loadEnv();
  const queue = env.REDIS_URL ? getNotificationQueue(env.REDIS_URL) : null;
  const notificationService = new NotificationService(
    new PostgresNotificationRepository(db), new PostgresPushTokenRepository(db), queue,
  );
  return new EngagementService(
    notificationService, new PostgresNotificationRepository(db),
    new PostgresCheckinRepository(db), new PostgresUserRepository(db),
    new PostgresMembershipRepository(db), new PostgresMilestoneRepository(db),
  );
}

async function processEngagementJob(job: Job): Promise<void> {
  const jobName = job.name as EngagementJobName;
  const service = buildEngagementService();
  switch (jobName) {
    case "weekly-summary": await service.processWeeklySummary(); break;
    case "inactivity-nudge": await service.processInactivityNudge(); break;
    default:
      log.warn("unknown job name", { component: "engagement", jobName });
  }
}

let engagementWorker: Worker | null = null;

export function startEngagementWorker(redisUrl: string): Worker {
  if (engagementWorker) return engagementWorker;
  engagementWorker = new Worker("engagement", processEngagementJob, {
    connection: { url: redisUrl }, concurrency: 1,
  });
  engagementWorker.on("failed", (job, err) => {
    log.error("job failed", {
      component: "engagement",
      jobName: job?.name,
      jobId: job?.id,
      err,
    });
  });
  return engagementWorker;
}

export async function closeEngagementWorker(): Promise<void> {
  if (engagementWorker) { await engagementWorker.close(); engagementWorker = null; }
}
