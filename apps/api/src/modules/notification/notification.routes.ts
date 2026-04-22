import { Router } from "express";
import { sendNotificationBodySchema } from "@tatame/validators";
import type { SendNotificationBody } from "@tatame/validators";
import { getDb } from "../../lib/db.js";
import { loadEnv } from "@tatame/config";
import { adminOnly } from "../../middleware/admin-only.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresNotificationRepository } from "./notification.repository.postgres.js";
import { PostgresPushTokenRepository } from "../push-token/push-token.repository.postgres.js";
import { getNotificationQueue } from "./notification.queue.js";
import { NotificationService } from "./notification.service.js";

export const notificationRouter = Router();

function buildService() {
  const db = getDb();
  const env = loadEnv();
  const queue = env.REDIS_URL ? getNotificationQueue(env.REDIS_URL) : null;
  return new NotificationService(
    new PostgresNotificationRepository(db),
    new PostgresPushTokenRepository(db),
    queue,
  );
}

notificationRouter.post(
  "/send",
  adminOnly,
  validateBody(sendNotificationBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as SendNotificationBody;
      const service = buildService();
      const rows = await service.send({
        recipientIds: body.recipientIds,
        title: body.title,
        body: body.body,
        category: body.category,
        data: body.data,
        academyId: body.academyId,
      });
      res.status(201).json({
        created: rows.length,
        ids: rows.map((r) => r.id),
      });
    } catch (e) {
      next(e);
    }
  },
);
