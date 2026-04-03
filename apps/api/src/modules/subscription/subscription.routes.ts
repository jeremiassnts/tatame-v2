import { Router } from "express";
import { Role } from "@tatame/types";
import type {
  CreateSubscriptionPlanBody,
  SelectStudentPlanBody,
  UpdateSubscriptionPlanBody,
} from "@tatame/validators";
import {
  createSubscriptionPlanBodySchema,
  listAcademySubscriptionsQuerySchema,
  listPlansQuerySchema,
  planIdParamSchema,
  selectStudentPlanBodySchema,
  subscriptionIdParamSchema,
  updateSubscriptionPlanBodySchema,
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
import { PostgresClassRepository } from "../class/class.repository.postgres.js";
import { PostgresManagerSubscriptionRepository } from "../manager-subscription/manager-subscription.repository.postgres.js";
import { ManagerSubscriptionService } from "../manager-subscription/manager-subscription.service.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import {
  PostgresStudentSubscriptionRepository,
  PostgresSubscriptionPlanRepository,
} from "./subscription.repository.postgres.js";
import { SubscriptionService } from "./subscription.service.js";
import { loadEnv } from "@tatame/config";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { getEmailQueue } from "../email/email.queue.js";
import { EmailService } from "../email/email.service.js";

export const subscriptionRouter = Router();

const db = getDb();
const env = loadEnv();
const academyRepo = new PostgresAcademyRepository(db);
const userRepo = new PostgresUserRepository(db);
const emailService = env.REDIS_URL
  ? new EmailService(getEmailQueue(env.REDIS_URL))
  : null;

const subscriptionService = new SubscriptionService(
  new PostgresSubscriptionPlanRepository(db),
  new PostgresStudentSubscriptionRepository(db),
  academyRepo,
);
const managerSubService = new ManagerSubscriptionService(
  new PostgresManagerSubscriptionRepository(db),
  academyRepo,
  new PostgresMembershipRepository(db),
  new PostgresClassRepository(db),
  new PostgresSubscriptionPlanRepository(db),
);

subscriptionRouter.get(
  "/plans",
  authorize(Role.Manager, Role.Instructor, Role.Student),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const query = listPlansQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new HttpError(400, "Invalid query");
      }
      const academyId = req.appAuth!.activeAcademyId!;
      const items = await subscriptionService.listPlans(academyId, {
        includeInactive: query.data.includeInactive ?? false,
        requesterRole: req.appAuth!.role,
      });
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

subscriptionRouter.post(
  "/plans",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(createSubscriptionPlanBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as CreateSubscriptionPlanBody;
      const userId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;

      if (req.appAuth?.role === "manager") {
        await managerSubService.canCreatePlan(academyId);
      }

      const created = await subscriptionService.createPlan(userId, academyId, body);
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  },
);

subscriptionRouter.get(
  "/plans/:planId",
  authorize(Role.Manager, Role.Instructor, Role.Student),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const params = planIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid plan id");
      }
      const academyId = req.appAuth!.activeAcademyId!;
      const row = await subscriptionService.getPlan(academyId, params.data.planId);
      res.json(row);
    } catch (e) {
      next(e);
    }
  },
);

subscriptionRouter.patch(
  "/plans/:planId",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(updateSubscriptionPlanBodySchema),
  async (req, res, next) => {
    try {
      const params = planIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid plan id");
      }
      const body = req.validatedBody as UpdateSubscriptionPlanBody;
      if (Object.keys(body).length === 0) {
        throw new HttpError(400, "At least one field is required");
      }
      const userId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;
      const updated = await subscriptionService.updatePlan(
        userId,
        academyId,
        params.data.planId,
        body,
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

subscriptionRouter.get(
  "/me",
  authorize(Role.Manager, Role.Instructor, Role.Student),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const userId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;
      const payload = await subscriptionService.getMySubscription(userId, academyId);
      res.json(payload);
    } catch (e) {
      next(e);
    }
  },
);

subscriptionRouter.get(
  "/academy",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const query = listAcademySubscriptionsQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new HttpError(400, "Invalid query");
      }
      const managerUserId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;
      const items = await subscriptionService.listAcademySubscriptions(
        managerUserId,
        academyId,
        {
          status: query.data.status,
          planId: query.data.planId,
          pendingPayment: query.data.pendingPayment,
        },
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

subscriptionRouter.get(
  "/academy/:subscriptionId",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const params = subscriptionIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid subscription id");
      }
      const managerUserId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;
      const item = await subscriptionService.getAcademySubscription(
        managerUserId,
        academyId,
        params.data.subscriptionId,
      );
      res.json(item);
    } catch (e) {
      next(e);
    }
  },
);

subscriptionRouter.post(
  "/me/plan",
  authorize(Role.Student),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(selectStudentPlanBodySchema),
  async (req, res, next) => {
    try {
      const { planId } = req.validatedBody as SelectStudentPlanBody;
      if (req.appAuth!.academyRole !== Role.Student) {
        throw new HttpError(
          403,
          "Only students with an active student membership can select a plan",
        );
      }
      const userId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;
      const result = await subscriptionService.selectPlan(userId, academyId, planId);

      // Send enrollment email
      if (emailService) {
        const student = await userRepo.findById(userId);
        const academy = await academyRepo.findById(academyId);
        if (student && academy) {
          await emailService.sendPlanEnrolled(
            {
              email: student.email,
              studentName: student.name,
              planName: result.plan.name,
              academyName: academy.name,
              startsAt: result.subscription.startsAt,
              expiresAt: result.subscription.expiresAt,
            },
            result.subscription.id,
          );
        }
      }

      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  },
);
