import { loadEnv } from "@tatame/config";
import { Role } from "@tatame/types";
import type { CreateCheckinBody } from "@tatame/validators";
import { checkinHistoryQuerySchema, createCheckinBodySchema } from "@tatame/validators";
import { Router } from "express";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import {
  attachActiveAcademyContext,
  requireActiveAcademy,
} from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresClassRepository } from "../class/class.repository.postgres.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { NotificationDispatcher } from "../notification/notification-dispatcher.js";
import { getNotificationQueue } from "../notification/notification.queue.js";
import { PostgresNotificationRepository } from "../notification/notification.repository.postgres.js";
import { NotificationService } from "../notification/notification.service.js";
import { PostgresPushTokenRepository } from "../push-token/push-token.repository.postgres.js";
import { PostgresPaymentRepository } from "../payment/payment.repository.postgres.js";
import { PostgresStudentSubscriptionRepository } from "../subscription/subscription.repository.postgres.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import type { CheckinRow } from "./checkin.repository.js";
import { PostgresCheckinRepository } from "./checkin.repository.postgres.js";
import { CheckinService } from "./checkin.service.js";
import { PostgresMilestoneRepository } from "../engagement/milestone.repository.postgres.js";
import { EngagementService } from "../engagement/engagement.service.js";

export const checkinRouter = Router();

function buildDispatcher(db: ReturnType<typeof getDb>) {
  const env = loadEnv();
  const queue = env.REDIS_URL ? getNotificationQueue(env.REDIS_URL) : null;
  const notificationService = new NotificationService(
    new PostgresNotificationRepository(db),
    new PostgresPushTokenRepository(db),
    queue,
  );
  return new NotificationDispatcher(
    notificationService,
    new PostgresUserRepository(db),
    new PostgresMembershipRepository(db),
  );
}

function buildEngagementService(db: ReturnType<typeof getDb>) {
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

const db = getDb();
const checkinService = new CheckinService(
  new PostgresMembershipRepository(db),
  new PostgresClassRepository(db),
  new PostgresStudentSubscriptionRepository(db),
  new PostgresPaymentRepository(db),
  new PostgresCheckinRepository(db),
  buildDispatcher(db),
  buildEngagementService(db),
);

function formatCheckinRow(row: CheckinRow) {
  const dateStr = row.date.slice(0, 10);
  const weekStr = row.weekReference.slice(0, 10);
  return {
    id: row.id,
    classId: row.classId,
    userId: row.userId,
    checkedInAt: row.checkedInAt.toISOString(),
    date: dateStr,
    weekReference: weekStr,
  };
}

checkinRouter.get(
  "/me/weekly-count",
  authorize(Role.Student, Role.Instructor),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const userId = req.appAuth!.userId;
      const result = await checkinService.getWeeklyCount(userId);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

checkinRouter.get(
  "/me/history",
  authorize(Role.Student, Role.Instructor),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const query = checkinHistoryQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new HttpError(400, "Invalid query");
      }
      const userId = req.appAuth!.userId;
      const result = await checkinService.getHistory(userId, {
        cursor: query.data.cursor,
        limit: query.data.limit,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

checkinRouter.post(
  "/",
  authorize(Role.Student),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(createCheckinBodySchema),
  async (req, res, next) => {
    try {
      const auth = req.appAuth!;
      if (auth.academyRole !== Role.Student) {
        throw new HttpError(403, "Only students can check in");
      }
      const body = req.validatedBody as CreateCheckinBody;
      const { checkin, warnings } = await checkinService.checkIn({
        userId: auth.userId,
        academyId: auth.activeAcademyId!,
        academyRole: auth.academyRole,
        classId: body.classId,
        sessionDate: body.date,
      });

      const payload: {
        checkin: ReturnType<typeof formatCheckinRow>;
        warnings?: { subscriptionGrace?: true; paymentOverdue?: true };
      } = { checkin: formatCheckinRow(checkin) };

      if (
        warnings.subscriptionGrace === true ||
        warnings.paymentOverdue === true
      ) {
        payload.warnings = {};
        if (warnings.subscriptionGrace) {
          payload.warnings.subscriptionGrace = true;
        }
        if (warnings.paymentOverdue) {
          payload.warnings.paymentOverdue = true;
        }
      }

      res.status(201).json(payload);
    } catch (e) {
      next(e);
    }
  },
);
