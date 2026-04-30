import { Queue } from "bullmq";

export type NotificationJobData = {
  notificationId: string;
  recipientId: string;
  expoPushToken: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

let notificationQueue: Queue | null = null;

export function getNotificationQueue(redisUrl: string): Queue {
  if (!notificationQueue) {
    notificationQueue = new Queue("push-notifications", {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return notificationQueue;
}

export async function closeNotificationQueue(): Promise<void> {
  if (notificationQueue) {
    await notificationQueue.close();
    notificationQueue = null;
  }
}
