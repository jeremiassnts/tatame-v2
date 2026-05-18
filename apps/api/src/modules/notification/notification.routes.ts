import { Router } from "express";
import { getAuth } from "@clerk/express";
import { Role } from "@tatame/types";
import {
  sendNotificationBodySchema,
  listNotificationsQuerySchema,
  sendCustomNotificationBodySchema,
} from "@tatame/validators";
import type {
  SendNotificationBody,
  SendCustomNotificationBody,
} from "@tatame/validators";
import { getDb } from "../../lib/db.js";
import { loadEnv } from "@tatame/config";
import { adminOnly } from "../../middleware/admin-only.js";
import { authorize } from "../../middleware/authorize.js";
import {
  attachActiveAcademyContext,
  requireActiveAcademy,
} from "../../middleware/academy-context.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresNotificationRepository } from "./notification.repository.postgres.js";
import { PostgresPushTokenRepository } from "../push-token/push-token.repository.postgres.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { getNotificationQueue } from "./notification.queue.js";
import { NotificationService } from "./notification.service.js";

export const notificationRouter = Router();

const CUSTOM_NOTIFICATION_DAILY_LIMIT = 5;

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
      const query = parsed.data;
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

// ── Manager custom notifications ──────────────────────────────────────────────

notificationRouter.get(
  "/custom-quota",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const academyId = req.appAuth!.activeAcademyId!;
      const db = getDb();
      const notifRepo = new PostgresNotificationRepository(db);
      const used = await notifRepo.countCustomSendsToday(academyId);
      res.json({
        used,
        limit: CUSTOM_NOTIFICATION_DAILY_LIMIT,
        remaining: Math.max(0, CUSTOM_NOTIFICATION_DAILY_LIMIT - used),
      });
    } catch (e) {
      next(e);
    }
  },
);

notificationRouter.post(
  "/send-custom",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(sendCustomNotificationBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as SendCustomNotificationBody;
      const senderId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;

      const db = getDb();
      const notifRepo = new PostgresNotificationRepository(db);
      const membershipRepo = new PostgresMembershipRepository(db);

      // Rate limit check
      const usedToday = await notifRepo.countCustomSendsToday(academyId);
      if (usedToday >= CUSTOM_NOTIFICATION_DAILY_LIMIT) {
        res.status(429).json({
          error: "Limite diário de notificações atingido",
          used: usedToday,
          limit: CUSTOM_NOTIFICATION_DAILY_LIMIT,
          remaining: 0,
        });
        return;
      }

      // Resolve recipients based on filter
      let recipientClerkIds: string[];

      switch (body.recipientFilter) {
        case "all":
          recipientClerkIds =
            await membershipRepo.findAllActiveClerkIdsByAcademy(academyId);
          break;
        case "students":
          recipientClerkIds =
            await membershipRepo.findActiveStudentClerkIdsByAcademy(academyId);
          break;
        case "instructors":
          recipientClerkIds =
            await membershipRepo.findActiveInstructorClerkIdsByAcademy(
              academyId,
            );
          break;
        case "specific": {
          const userRepo = new PostgresUserRepository(db);
          const idMap = await userRepo.findClerkIdsByInternalIds(
            body.specificUserIds!,
          );
          recipientClerkIds = [...idMap.values()];
          break;
        }
      }

      if (recipientClerkIds.length === 0) {
        res.status(400).json({ error: "Nenhum destinatário encontrado" });
        return;
      }

      // Record the send action for rate limiting
      await notifRepo.createCustomSend({ academyId, senderId });

      // Send notifications via existing pipeline
      const service = buildService();
      const rows = await service.send({
        recipientIds: recipientClerkIds,
        title: body.title,
        body: body.body,
        category: "announcement",
        academyId,
      });

      const remaining = Math.max(
        0,
        CUSTOM_NOTIFICATION_DAILY_LIMIT - usedToday - 1,
      );

      res.status(201).json({
        sent: rows.length,
        remaining,
      });
    } catch (e) {
      next(e);
    }
  },
);
