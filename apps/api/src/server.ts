import "./env-bootstrap.js";
import { loadEnv } from "@tatame/config";
import { logger } from "./lib/logger.js";
import { createApp } from "./app.js";
import { runMigrations } from "./migrate.js";
import { closeEmailQueue, getEmailQueue } from "./modules/email/email.queue.js";
import {
  startEmailWorker,
  closeEmailWorker,
} from "./modules/email/email.worker.js";
import {
  closeNotificationQueue,
  getNotificationQueue,
} from "./modules/notification/notification.queue.js";
import {
  startNotificationWorker,
  closeNotificationWorker,
} from "./modules/notification/notification.worker.js";
import { closeEngagementQueue, getEngagementQueue, registerEngagementJobs } from "./modules/engagement/engagement.queue.js";
import { startEngagementWorker, closeEngagementWorker } from "./modules/engagement/engagement.worker.js";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import basicAuth from "express-basic-auth";

const env = loadEnv();

if (env.NODE_ENV === "production") {
  logger.info("Running database migrations...");
  await runMigrations(env.DATABASE_URL, "./drizzle");
}

const app = createApp();

// Start email worker if Redis is available
if (env.REDIS_URL) {
  startEmailWorker(env.REDIS_URL);
  logger.info("[email] Worker started");
  startNotificationWorker(env.REDIS_URL);
  logger.info("[push] Notification worker started");
  startEngagementWorker(env.REDIS_URL);
  await registerEngagementJobs(env.REDIS_URL);
  logger.info("[engagement] Worker started, cron jobs registered");

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");
  createBullBoard({
    queues: [
      new BullMQAdapter(getEmailQueue(env.REDIS_URL)),
      new BullMQAdapter(getNotificationQueue(env.REDIS_URL)),
      new BullMQAdapter(getEngagementQueue(env.REDIS_URL)),
    ],
    serverAdapter,
  });
  const bullUser = env.BULL_BOARD_USER;
  const bullPass = env.BULL_BOARD_PASS;
  if (bullUser && bullPass) {
    app.use(
      "/admin/queues",
      basicAuth({ users: { [bullUser]: bullPass }, challenge: true }),
      serverAdapter.getRouter(),
    );
  } else {
    logger.warn("[bull-board] BULL_BOARD_USER/BULL_BOARD_PASS not set — dashboard disabled");
  }
  logger.info("[bull-board] Dashboard at /admin/queues");
}

const server = app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT }, "API listening");
});

// Graceful shutdown
async function shutdown() {
  logger.info("Shutting down...");
  server.close();
  await closeEmailWorker();
  await closeEmailQueue();
  await closeNotificationWorker();
  await closeNotificationQueue();
  await closeEngagementWorker();
  await closeEngagementQueue();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
