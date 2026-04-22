import { Expo, type ExpoPushTicket } from "expo-server-sdk";
import { Worker, type Job } from "bullmq";
import { logger } from "../../lib/logger.js";
import { getDb } from "../../lib/db.js";
import { PostgresNotificationRepository } from "./notification.repository.postgres.js";
import { PostgresPushTokenRepository } from "../push-token/push-token.repository.postgres.js";
import type { NotificationJobData } from "./notification.queue.js";

const expo = new Expo();

async function processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
  const { notificationId, expoPushToken, title, body, data } = job.data;

  if (!Expo.isExpoPushToken(expoPushToken)) {
    logger.warn({ expoPushToken, notificationId }, "[push] Invalid Expo push token, removing");
    const db = getDb();
    const pushTokenRepo = new PostgresPushTokenRepository(db);
    await pushTokenRepo.deleteByToken(expoPushToken);
    return;
  }

  const [ticket] = await expo.sendPushNotificationsAsync([
    {
      to: expoPushToken,
      sound: "default",
      title,
      body,
      data: data ?? {},
    },
  ]);

  if (!ticket) {
    throw new Error("No ticket returned from Expo");
  }

  const db = getDb();
  const notificationRepo = new PostgresNotificationRepository(db);

  if (ticket.status === "ok") {
    await notificationRepo.updateStatus(notificationId, "sent", new Date());
    return;
  }

  // ticket.status === "error"
  const errorTicket = ticket as ExpoPushTicket & { details?: { error?: string } };
  logger.error(
    { notificationId, error: errorTicket.message, details: errorTicket.details },
    "[push] Expo push error",
  );

  if (errorTicket.details?.error === "DeviceNotRegistered") {
    const pushTokenRepo = new PostgresPushTokenRepository(db);
    await pushTokenRepo.deleteByToken(expoPushToken);
    logger.info({ expoPushToken }, "[push] Removed stale token (DeviceNotRegistered)");
  }

  await notificationRepo.updateStatus(notificationId, "failed");
  throw new Error(`Expo push error: ${errorTicket.message}`);
}

let notificationWorker: Worker | null = null;

export function startNotificationWorker(redisUrl: string): Worker {
  if (notificationWorker) return notificationWorker;

  notificationWorker = new Worker("push-notifications", processNotificationJob, {
    connection: { url: redisUrl },
    concurrency: 10,
  });

  notificationWorker.on("failed", (job, err) => {
    logger.error(
      { jobName: job?.name, jobId: job?.id, err: err.message },
      "[push] Job failed",
    );
  });

  return notificationWorker;
}

export async function closeNotificationWorker(): Promise<void> {
  if (notificationWorker) {
    await notificationWorker.close();
    notificationWorker = null;
  }
}
