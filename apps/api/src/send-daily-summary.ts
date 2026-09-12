/**
 * Sends the daily platform summary on demand, for a day you choose.
 *
 *   pnpm --filter @tatame/api summary:send            # the BRT day that just ended
 *   pnpm --filter @tatame/api summary:send 2026-09-11 # a specific BRT day
 *
 * It runs the real path — the report is built from the database, enqueued on the
 * `email` queue and delivered by the same worker production uses — so what lands
 * in the inbox is what the cron would send at 07:00 BRT. The only difference is
 * who pressed the button.
 *
 * Re-running the same date works: the job id is derived from the date and would
 * otherwise be deduplicated by BullMQ, so any previous job for that day is
 * dropped first.
 */
import { loadEnv } from "@tatame/config";
import { QueueEvents } from "bullmq";
import { getDb } from "./lib/db.js";
import { closeEmailQueue, getEmailQueue } from "./modules/email/email.queue.js";
import { EmailService } from "./modules/email/email.service.js";
import {
  closeEmailWorker,
  startEmailWorker,
} from "./modules/email/email.worker.js";
import { PostgresPlatformSummaryRepository } from "./modules/platform-summary/platform-summary.repository.postgres.js";
import {
  PlatformSummaryService,
  previousBrtDate,
} from "./modules/platform-summary/platform-summary.service.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

async function main() {
  const env = loadEnv();
  const referenceDate = process.argv[2] ?? previousBrtDate(new Date());

  if (!DATE_PATTERN.test(referenceDate)) {
    throw new Error(`Expected a YYYY-MM-DD date, got "${referenceDate}"`);
  }
  if (!env.REDIS_URL) {
    throw new Error("REDIS_URL is required — the email queue lives in Redis");
  }
  if (!env.ADMIN_EMAIL) {
    throw new Error("ADMIN_EMAIL is required — it is who the summary goes to");
  }
  if (!env.RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is required — without it the worker skips the send",
    );
  }

  const queue = getEmailQueue(env.REDIS_URL);
  const jobId = `daily-summary-${referenceDate}`;

  const previous = await queue.getJob(jobId);
  if (previous) {
    await previous.remove();
    console.log(`Removed the previous job for ${referenceDate}`);
  }

  const service = new PlatformSummaryService(
    new PostgresPlatformSummaryRepository(getDb()),
    new EmailService(queue),
    env.ADMIN_EMAIL,
  );

  console.log(`Building the summary for ${referenceDate}...`);
  const report = await service.buildReport(referenceDate);
  console.log(
    `  ${report.academies.length} academies · ` +
      `R$ ${(report.revenue.grossCents / 100).toFixed(2)} gross · ` +
      `${report.newUsers.value} new users`,
  );

  await service.sendDailySummary(referenceDate);

  const queueEvents = new QueueEvents("email", {
    connection: { url: env.REDIS_URL },
  });
  await queueEvents.waitUntilReady();
  startEmailWorker(env.REDIS_URL);

  const job = await queue.getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} vanished before it could be sent`);

  console.log(`Sending to ${env.ADMIN_EMAIL}...`);
  await job.waitUntilFinished(queueEvents);
  console.log("Sent.");

  await queueEvents.close();
  await closeEmailWorker();
  await closeEmailQueue();
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to send the daily summary:", err);
  process.exit(1);
});
