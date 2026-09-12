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
import { emitEvent } from "../../telemetry/events.js";
import {
  attachActiveAcademyContext,
  requireActiveAcademy,
} from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { requireActivePlan } from "../../middleware/require-active-plan.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresAcademyRepository } from "../academy/academy.repository.postgres.js";
import { PostgresPayoutAccountRepository } from "../payout-account/payout-account.repository.postgres.js";
import { PostgresManagerSubscriptionRepository } from "../manager-subscription/manager-subscription.repository.postgres.js";
import {
  PostgresStudentSubscriptionRepository,
  PostgresSubscriptionPlanRepository,
} from "./subscription.repository.postgres.js";
import { SubscriptionService } from "./subscription.service.js";
import { loadEnv } from "@tatame/config";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { getEmailQueue } from "../email/email.queue.js";
import { EmailService } from "../email/email.service.js";
import { PostgresDependentRepository } from "../dependent/dependent.repository.postgres.js";
import { PostgresGraduationRepository } from "../graduation/graduation.repository.postgres.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { DependentService } from "../dependent/dependent.service.js";

export const subscriptionRouter = Router();

const db = getDb();
const env = loadEnv();
const academyRepo = new PostgresAcademyRepository(db);
const userRepo = new PostgresUserRepository(db);
const emailService = env.REDIS_URL
  ? new EmailService(getEmailQueue(env.REDIS_URL))
  : null;

const managerSubRepo = new PostgresManagerSubscriptionRepository(db);

const dependentService = new DependentService(
  new PostgresDependentRepository(db),
  new PostgresMembershipRepository(db),
  new PostgresGraduationRepository(db),
  new PostgresStudentSubscriptionRepository(db),
);

const subscriptionService = new SubscriptionService(
  new PostgresSubscriptionPlanRepository(db),
  new PostgresStudentSubscriptionRepository(db),
  academyRepo,
  managerSubRepo,
  new PostgresPayoutAccountRepository(db),
);

subscriptionRouter.get(
  "/plans",
  authorize(Role.Manager, Role.Instructor, Role.Student, Role.Guardian),
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
  requireActivePlan,
  validateBody(createSubscriptionPlanBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as CreateSubscriptionPlanBody;
      const userId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;

      const created = await subscriptionService.createPlan(userId, academyId, body);
      emitEvent("subscription.plan_created", {
        userId,
        academyId,
        planId: created.id,
      });
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  },
);

subscriptionRouter.get(
  "/plans/:planId",
  authorize(Role.Manager, Role.Instructor, Role.Student, Role.Guardian),
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
  requireActivePlan,
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
      emitEvent("subscription.plan_updated", {
        userId,
        academyId,
        planId: params.data.planId,
        extra: { fields: Object.keys(body).sort().join(",") },
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

subscriptionRouter.get(
  "/me",
  authorize(Role.Manager, Role.Instructor, Role.Student, Role.Guardian),
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
  "/dependent/:dependentId",
  authorize(Role.Student, Role.Guardian, Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const { dependentId } = req.params;
      if (!dependentId) {
        res.status(400).json({ error: "dependentId required" });
        return;
      }
      const auth = req.appAuth!;
      await dependentService.getById(auth.userId, auth.role, dependentId, auth.activeAcademyId);
      const academyId = auth.activeAcademyId!;
      const payload = await subscriptionService.getSubscriptionForDependent(
        dependentId,
        academyId,
      );
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
  authorize(Role.Student, Role.Guardian),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(selectStudentPlanBodySchema),
  async (req, res, next) => {
    try {
      const { planId, dependentId } = req.validatedBody as SelectStudentPlanBody;
      const role = req.appAuth!.role;
      if (role !== Role.Student && role !== Role.Guardian) {
        throw new HttpError(
          403,
          "Only students or guardians can select a plan",
        );
      }
      if (role === Role.Guardian && !dependentId) {
        throw new HttpError(400, "dependentId is required for guardians");
      }
      const userId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;
      const result = await subscriptionService.selectPlan(userId, academyId, planId, {
        dependentId: dependentId ?? null,
      });

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

      emitEvent("subscription.plan_assigned", {
        userId,
        academyId,
        planId,
        subscriptionId: result.subscription.id,
        ...(dependentId ? { dependentId } : {}),
      });
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  },
);
