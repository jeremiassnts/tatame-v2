import { loadEnv } from "@tatame/config";
import { Router, type Request } from "express";
import { eq, and } from "drizzle-orm";
import { users, checkins } from "@tatame/db";
import { Role } from "@tatame/types";
import type { CreateClassBody, UpdateClassBody } from "@tatame/validators";
import {
  classIdParamSchema,
  createClassBodySchema,
  listClassesQuerySchema,
  updateClassBodySchema,
} from "@tatame/validators";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import {
  attachActiveAcademyContext,
  requireActiveAcademy,
} from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresAcademyRepository } from "../academy/academy.repository.postgres.js";
import { PostgresManagerSubscriptionRepository } from "../manager-subscription/manager-subscription.repository.postgres.js";
import { ManagerSubscriptionService } from "../manager-subscription/manager-subscription.service.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { NotificationDispatcher } from "../notification/notification-dispatcher.js";
import { getNotificationQueue } from "../notification/notification.queue.js";
import { PostgresNotificationRepository } from "../notification/notification.repository.postgres.js";
import { NotificationService } from "../notification/notification.service.js";
import { PostgresPushTokenRepository } from "../push-token/push-token.repository.postgres.js";
import { PostgresSubscriptionPlanRepository } from "../subscription/subscription.repository.postgres.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { PostgresClassRepository } from "./class.repository.postgres.js";
import { ClassService } from "./class.service.js";
import type { ClassRow } from "./class.repository.js";

export const classRouter = Router();

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

const db = getDb();
const classService = new ClassService(
  new PostgresClassRepository(db),
  new PostgresMembershipRepository(db),
  new PostgresAcademyRepository(db),
  buildDispatcher(db),
);
const managerSubService = new ManagerSubscriptionService(
  new PostgresManagerSubscriptionRepository(db),
  new PostgresAcademyRepository(db),
  new PostgresMembershipRepository(db),
  new PostgresClassRepository(db),
  new PostgresSubscriptionPlanRepository(db),
);

function classCtx(req: Request) {
  const a = req.appAuth!;
  return {
    userId: a.userId,
    role: a.role,
    activeAcademyId: a.activeAcademyId!,
  };
}

async function enrichWithInstructorName(
  rows: ClassRow[],
): Promise<(ClassRow & { instructorName: string | null })[]> {
  const ids = [...new Set(rows.map((r) => r.instructorId))];
  if (ids.length === 0) return [];
  const userRows = await Promise.all(
    ids.map((id) =>
      db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, id)).limit(1),
    ),
  );
  const nameMap = new Map<string, string>();
  for (const [row] of userRows) {
    if (row) nameMap.set(row.id, row.name);
  }
  return rows.map((r) => ({ ...r, instructorName: nameMap.get(r.instructorId) ?? null }));
}

classRouter.get(
  "/",
  authorize(Role.Manager, Role.Instructor, Role.Student),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const query = listClassesQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new HttpError(400, "Invalid query");
      }
      const items = await classService.list(classCtx(req), query.data);
      const enriched = await enrichWithInstructorName(items);
      res.json({ items: enriched });
    } catch (e) {
      next(e);
    }
  },
);

classRouter.get(
  "/:classId",
  authorize(Role.Manager, Role.Instructor, Role.Student),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const params = classIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid class id");
      }
      const row = await classService.getById(
        classCtx(req),
        params.data.classId,
      );
      const [enriched] = await enrichWithInstructorName([row]);
      res.json(enriched);
    } catch (e) {
      next(e);
    }
  },
);

classRouter.post(
  "/",
  authorize(Role.Manager, Role.Instructor),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(createClassBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as CreateClassBody;

      if (req.appAuth?.role === "manager") {
        await managerSubService.canCreateClass(
          req.appAuth.activeAcademyId!,
          body.dayOfWeek,
        );
      }

      const created = await classService.create(classCtx(req), body);
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  },
);

classRouter.patch(
  "/:classId",
  authorize(Role.Manager, Role.Instructor),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(updateClassBodySchema),
  async (req, res, next) => {
    try {
      const params = classIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid class id");
      }
      const body = req.validatedBody as UpdateClassBody;
      const updated = await classService.update(
        classCtx(req),
        params.data.classId,
        body,
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

classRouter.delete(
  "/:classId",
  authorize(Role.Manager, Role.Instructor),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const params = classIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid class id");
      }
      const updated = await classService.deactivate(
        classCtx(req),
        params.data.classId,
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

classRouter.get(
  "/:classId/checkins",
  authorize(Role.Manager, Role.Instructor, Role.Student),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const params = classIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid class id");
      }
      const date =
        typeof req.query.date === "string" ? req.query.date : undefined;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new HttpError(400, "date query param required (YYYY-MM-DD)");
      }
      // Verify the class belongs to this academy and the user has access
      await classService.getById(classCtx(req), params.data.classId);

      const rows = await db
        .select({
          id: checkins.id,
          classId: checkins.classId,
          userId: checkins.userId,
          checkedInAt: checkins.checkedInAt,
          date: checkins.date,
          userName: users.name,
          userProfileImageUrl: users.profileImageUrl,
        })
        .from(checkins)
        .innerJoin(users, eq(checkins.userId, users.id))
        .where(
          and(
            eq(checkins.classId, params.data.classId),
            eq(checkins.date, date),
          ),
        )
        .orderBy(checkins.checkedInAt);

      res.json({
        items: rows.map((r) => ({
          id: r.id,
          classId: r.classId,
          userId: r.userId,
          checkedInAt: r.checkedInAt.toISOString(),
          date: typeof r.date === "string" ? r.date.slice(0, 10) : r.date,
          userName: r.userName,
          userProfileImageUrl: r.userProfileImageUrl,
        })),
      });
    } catch (e) {
      next(e);
    }
  },
);
