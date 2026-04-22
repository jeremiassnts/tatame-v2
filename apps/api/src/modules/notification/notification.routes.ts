import { Router } from "express";
import { getAuth } from "@clerk/express";
import { Role } from "@tatame/types";
import { sendNotificationBodySchema, listNotificationsQuerySchema } from "@tatame/validators";
import type { SendNotificationBody, ListNotificationsQuery } from "@tatame/validators";
import { getDb } from "../../lib/db.js";
import { loadEnv } from "@tatame/config";
import { adminOnly } from "../../middleware/admin-only.js";
import { authorize } from "../../middleware/authorize.js";
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

// ── User-facing notification center ────────────────────────────────────────────

notificationRouter.get(
  "/unread-count",
  authorize(Role.Manager, Role.Instructor, Role.Student),
  async (req, res, next) => {
    try {
      const { userId: clerkId } = getAuth(req);
      if (!clerkId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const service = buildService();
      const count = await service.getUnreadCount(clerkId);
      res.json({ count });
    } catch (e) {
      next(e);
    }
  },
);

notificationRouter.get(
  "/",
  authorize(Role.Manager, Role.Instructor, Role.Student),
  async (req, res, next) => {
    try {
      const { userId: clerkId } = getAuth(req);
      if (!clerkId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const parsed = listNotificationsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const query = parsed.data as ListNotificationsQuery;
      const service = buildService();
      const [listResult, unreadCount] = await Promise.all([
        service.listForUser(clerkId, query.cursor, query.limit),
        service.getUnreadCount(clerkId),
      ]);
      res.json({ ...listResult, unreadCount });
    } catch (e) {
      next(e);
    }
  },
);

notificationRouter.patch(
  "/:id/read",
  authorize(Role.Manager, Role.Instructor, Role.Student),
  async (req, res, next) => {
    try {
      const { userId: clerkId } = getAuth(req);
      if (!clerkId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: "id is required" });
        return;
      }
      const service = buildService();
      await service.markAsRead(id, clerkId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  },
);

notificationRouter.post(
  "/read-all",
  authorize(Role.Manager, Role.Instructor, Role.Student),
  async (req, res, next) => {
    try {
      const { userId: clerkId } = getAuth(req);
      if (!clerkId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const service = buildService();
      const updated = await service.markAllAsRead(clerkId);
      res.json({ updated });
    } catch (e) {
      next(e);
    }
  },
);

notificationRouter.delete(
  "/:id",
  authorize(Role.Manager, Role.Instructor, Role.Student),
  async (req, res, next) => {
    try {
      const { userId: clerkId } = getAuth(req);
      if (!clerkId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: "id is required" });
        return;
      }
      const service = buildService();
      await service.deleteNotification(id, clerkId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  },
);
