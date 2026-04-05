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
import { attachActiveAcademyContext } from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresAcademyRepository } from "../academy/academy.repository.postgres.js";
import { PostgresClassRepository } from "../class/class.repository.postgres.js";
import { getEmailQueue } from "../email/email.queue.js";
import { EmailService } from "../email/email.service.js";
import { PostgresManagerSubscriptionRepository } from "../manager-subscription/manager-subscription.repository.postgres.js";
import { ManagerSubscriptionService } from "../manager-subscription/manager-subscription.service.js";
import { PostgresSubscriptionPlanRepository } from "../subscription/subscription.repository.postgres.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { PostgresMembershipRepository } from "./membership.repository.postgres.js";
import { MembershipService } from "./membership.service.js";

export const membershipRouter = Router();

const db = getDb();
const env = loadEnv();
const membershipRepo = new PostgresMembershipRepository(db);
const academyRepo = new PostgresAcademyRepository(db);
const userRepo = new PostgresUserRepository(db);
const emailService = env.REDIS_URL
  ? new EmailService(getEmailQueue(env.REDIS_URL))
  : null;

const membershipService = new MembershipService(
  membershipRepo,
  academyRepo,
);
const managerSubService = new ManagerSubscriptionService(
  new PostgresManagerSubscriptionRepository(db),
  new PostgresAcademyRepository(db),
  membershipRepo,
  new PostgresClassRepository(db),
  new PostgresSubscriptionPlanRepository(db),
);

membershipRouter.get(
  "/",
  authorize(Role.Manager, Role.Instructor, Role.Student),
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
        req.appAuth!.role as "manager" | "instructor" | "student",
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
  authorize(Role.Instructor, Role.Student),
  attachActiveAcademyContext,
  validateBody(requestMembershipBodySchema),
  async (req, res, next) => {
    try {
      const { academyId } = req.validatedBody as RequestMembershipBody;
      const userId = req.appAuth!.userId;
      const role = req.appAuth!.role;
      const created = await membershipService.request(
        userId,
        role as "instructor" | "student",
        academyId,
      );
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
  async (req, res, next) => {
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }

      const pending = await membershipRepo.findById(params.data.membershipId);
      if (pending && req.appAuth?.role === "manager") {
        if (pending.role === "instructor") {
          await managerSubService.canApproveInstructor(req.appAuth.activeAcademyId!);
        } else if (pending.role === "student") {
          await managerSubService.canApproveStudent(req.appAuth.activeAcademyId!);
        }
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
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.post(
  "/leave",
  authorize(Role.Instructor, Role.Student),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const updated = await membershipService.leave(req.appAuth!.userId);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);
