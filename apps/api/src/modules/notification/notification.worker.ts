import { Expo } from "expo-server-sdk";
import { Worker, type Job } from "bullmq";
import { getDb } from "../../lib/db.js";
import { PostgresNotificationRepository } from "./notification.repository.postgres.js";
import { PostgresPushTokenRepository } from "../push-token/push-token.repository.postgres.js";
import type { NotificationJobData } from "./notification.queue.js";
import { log } from "../../telemetry/logger.js";

const expo = new Expo();

async function processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
  const { notificationId, expoPushToken, title, body, data } = job.data;

  if (!Expo.isExpoPushToken(expoPushToken)) {
    log.warn("invalid Expo push token, removing", {
      component: "push",
      expoPushToken,
      notificationId,
    });
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
  const errorTicket = ticket as {
    status: "error";
    message: string;
    details?: { error?: string };
  };
  log.error("Expo push error", {
    component: "push",
    notificationId,
    error: errorTicket.message,
    details: errorTicket.details,
  });

  if (errorTicket.details?.error === "DeviceNotRegistered") {
    const pushTokenRepo = new PostgresPushTokenRepository(db);
    await pushTokenRepo.deleteByToken(expoPushToken);
    log.info("removed stale token (DeviceNotRegistered)", {
      component: "push",
      expoPushToken,
    });
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
    log.error("job failed", {
      component: "push",
      jobName: job?.name,
      jobId: job?.id,
      err,
    });
  });

  return notificationWorker;
}

export async function closeNotificationWorker(): Promise<void> {
  if (notificationWorker) {
    await notificationWorker.close();
    notificationWorker = null;
  }
}
