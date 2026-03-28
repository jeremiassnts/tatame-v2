import { Router } from "express";
import { Role } from "@tatame/types";
import type { ConfirmManualPaymentBody } from "@tatame/validators";
import {
  confirmManualPaymentBodySchema,
  listPaymentsQuerySchema,
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
import { PostgresStudentSubscriptionRepository } from "../subscription/subscription.repository.postgres.js";
import { PostgresPaymentRepository } from "./payment.repository.postgres.js";
import { PaymentService } from "./payment.service.js";

export const paymentRouter = Router();

const db = getDb();
const paymentService = new PaymentService(
  new PostgresPaymentRepository(db),
  new PostgresStudentSubscriptionRepository(db),
  new PostgresAcademyRepository(db),
);

paymentRouter.post(
  "/",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(confirmManualPaymentBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as ConfirmManualPaymentBody;
      const managerUserId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;
      const created = await paymentService.confirmManual(
        managerUserId,
        academyId,
        body,
      );
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  },
);

paymentRouter.get(
  "/",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const query = listPaymentsQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new HttpError(400, "Invalid query");
      }
      const managerUserId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;
      const items = await paymentService.listForManager(
        managerUserId,
        academyId,
        {
          subscriptionId: query.data.subscriptionId,
          limit: query.data.limit,
        },
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

paymentRouter.get(
  "/me",
  authorize(Role.Student),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const studentUserId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;
      const items = await paymentService.listForStudent(
        studentUserId,
        academyId,
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);
