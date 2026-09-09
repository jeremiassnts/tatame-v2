import { loadEnv } from "@tatame/config";
import { Role } from "@tatame/types";
import type { RequestMembershipBody } from "@tatame/validators";
import {
  listMembersQuerySchema,
  membershipIdParamSchema,
  pendingQuerySchema,
  requestMembershipBodySchema,
} from "@tatame/validators";
import { Router } from "express";
import { z } from "zod";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import { emitEvent } from "../../telemetry/events.js";
import {
  attachActiveAcademyContext,
  requireActiveAcademy,
} from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { requireActivePlan } from "../../middleware/require-active-plan.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresAcademyRepository } from "../academy/academy.repository.postgres.js";
import { getEmailQueue } from "../email/email.queue.js";
import { EmailService } from "../email/email.service.js";
import { NotificationDispatcher } from "../notification/notification-dispatcher.js";
import { getNotificationQueue } from "../notification/notification.queue.js";
import { PostgresNotificationRepository } from "../notification/notification.repository.postgres.js";
import { NotificationService } from "../notification/notification.service.js";
import { PostgresPushTokenRepository } from "../push-token/push-token.repository.postgres.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { PostgresManagerSubscriptionRepository } from "../manager-subscription/manager-subscription.repository.postgres.js";
import { PostgresMembershipRepository } from "./membership.repository.postgres.js";
import { MembershipService } from "./membership.service.js";

export const membershipRouter = Router();

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
const env = loadEnv();
const membershipRepo = new PostgresMembershipRepository(db);
const academyRepo = new PostgresAcademyRepository(db);
const userRepo = new PostgresUserRepository(db);
const emailService = env.REDIS_URL
  ? new EmailService(getEmailQueue(env.REDIS_URL))
  : null;

const managerSubRepo = new PostgresManagerSubscriptionRepository(db);

const membershipService = new MembershipService(
  membershipRepo,
  academyRepo,
  buildDispatcher(db),
  managerSubRepo,
);

membershipRouter.get(
  "/",
  authorize(Role.Manager, Role.Instructor, Role.Student, Role.Guardian),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const query = listMembersQuerySchema
        .extend({ academyId: z.string().uuid() })
        .safeParse(req.query);
      if (!query.success) {
        throw new HttpError(400, "Query academyId (uuid) is required");
      }
      const { academyId, role, status, q } = query.data;
      const members = await membershipService.listMembers(
        academyId,
        req.appAuth!.userId,
        req.appAuth!.role as "manager" | "instructor" | "student" | "guardian",
        { role, status, q },
      );
      res.json(members);
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.post(
  "/requests",
  authorize(Role.Instructor, Role.Student, Role.Guardian),
  attachActiveAcademyContext,
  validateBody(requestMembershipBodySchema),
  async (req, res, next) => {
    try {
      const { academyId } = req.validatedBody as RequestMembershipBody;
      const userId = req.appAuth!.userId;
      const role = req.appAuth!.role;
      const created = await membershipService.request(
        userId,
        role as "instructor" | "student" | "guardian",
        academyId,
      );
      emitEvent("membership.requested", {
        userId,
        actorRole: role,
        academyId,
        membershipId: created.id,
      });
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.get(
  "/pending",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  requireActivePlan,
  async (req, res, next) => {
    try {
      const query = pendingQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new HttpError(400, "Query academyId (uuid) is required");
      }
      const managerUserId = req.appAuth!.userId;
      const items = await membershipService.listPending(
        query.data.academyId,
        managerUserId,
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.get(
  "/:membershipId",
  authorize(Role.Manager, Role.Instructor),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }
      const role = req.appAuth!.role;
      if (role !== "manager" && role !== "instructor") {
        throw new HttpError(403, "Forbidden");
      }
      const detail = await membershipService.getMemberDetail(
        params.data.membershipId,
        req.appAuth!.userId,
        role,
      );
      res.json(detail);
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.patch(
  "/:membershipId/approve",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  requireActivePlan,
  async (req, res, next) => {
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }

      const updated = await membershipService.approve(
        params.data.membershipId,
        req.appAuth!.userId,
      );

      // Send email notifications
      if (emailService && updated) {
        const member = await userRepo.findById(updated.userId);
        const academy = await academyRepo.findById(updated.academyId);
        const manager = await userRepo.findById(req.appAuth!.userId);

        if (member && academy) {
          await emailService.sendMemberApproved(
            {
              email: member.email,
              memberName: member.name,
              academyName: academy.name,
              role: updated.role as "student" | "instructor",
            },
            updated.id,
          );

          if (manager) {
            await emailService.sendManagerNewMember(
              {
                email: manager.email,
                managerName: manager.name,
                memberName: member.name,
                academyName: academy.name,
                role: updated.role as "student" | "instructor",
              },
              updated.id,
            );
          }
        }
      }

      emitEvent("membership.approved", {
        userId: req.appAuth!.userId,
        membershipId: updated.id,
        academyId: updated.academyId,
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.patch(
  "/:membershipId/reject",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  requireActivePlan,
  async (req, res, next) => {
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }
      const updated = await membershipService.reject(
        params.data.membershipId,
        req.appAuth!.userId,
      );
      emitEvent("membership.rejected", {
        userId: req.appAuth!.userId,
        membershipId: updated.id,
        academyId: updated.academyId,
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.patch(
  "/:membershipId/block",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  requireActivePlan,
  async (req, res, next) => {
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }
      const updated = await membershipService.block(
        params.data.membershipId,
        req.appAuth!.userId,
      );
      emitEvent("membership.blocked", {
        userId: req.appAuth!.userId,
        membershipId: updated.id,
        academyId: updated.academyId,
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.patch(
  "/:membershipId/unblock",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  requireActivePlan,
  async (req, res, next) => {
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }
      await membershipService.unblock(
        params.data.membershipId,
        req.appAuth!.userId,
      );
      emitEvent("membership.unblocked", {
        userId: req.appAuth!.userId,
        membershipId: params.data.membershipId,
      });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.post(
  "/leave",
  authorize(Role.Instructor, Role.Student, Role.Guardian),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const updated = await membershipService.leave(req.appAuth!.userId);
      emitEvent("membership.left", {
        userId: req.appAuth!.userId,
        membershipId: updated.id,
        // `leave` deletes a merely-pending membership instead of updating it,
        // and that branch returns `{ id, deleted }` with no academy.
        ...("deleted" in updated ? {} : { academyId: updated.academyId }),
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);
