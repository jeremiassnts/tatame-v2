import "./env-bootstrap.js";
import { loadEnv } from "@tatame/config";
import { createApp } from "./app.js";
import { runMigrations } from "./migrate.js";
import { closeEmailQueue, getEmailQueue } from "./modules/email/email.queue.js";
import {
  startEmailWorker,
  closeEmailWorker,
} from "./modules/email/email.worker.js";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import basicAuth from "express-basic-auth";

const env = loadEnv();

if (env.NODE_ENV === "production") {
  console.log("Running database migrations...");
  await runMigrations(env.DATABASE_URL, "./drizzle");
}

const app = createApp();

// Start email worker if Redis is available
if (env.REDIS_URL) {
  startEmailWorker(env.REDIS_URL);
  console.log("[email] Worker started");

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");
  createBullBoard({
    queues: [new BullMQAdapter(getEmailQueue(env.REDIS_URL))],
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
    console.warn(
      "[bull-board] BULL_BOARD_USER/BULL_BOARD_PASS not set — dashboard disabled",
    );
  }
  console.log("[bull-board] Dashboard at /admin/queues");
}

const server = app.listen(env.API_PORT, () => {
  console.log(`API listening on http://localhost:${env.API_PORT}/v1`);
});

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down...");
  server.close();
  await closeEmailWorker();
  await closeEmailQueue();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
