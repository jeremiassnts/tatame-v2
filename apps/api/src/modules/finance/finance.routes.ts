import { Router } from "express";
import { Role } from "@tatame/types";
import { getDb } from "../../lib/db.js";
import {
  attachActiveAcademyContext,
  requireActiveAcademy,
} from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { PostgresAcademyRepository } from "../academy/academy.repository.postgres.js";
import { PostgresPaymentRepository } from "../payment/payment.repository.postgres.js";
import { PostgresStudentSubscriptionRepository } from "../subscription/subscription.repository.postgres.js";
import { FinanceService } from "./finance.service.js";

export const financeRouter = Router();

const db = getDb();
const financeService = new FinanceService(
  new PostgresPaymentRepository(db),
  new PostgresStudentSubscriptionRepository(db),
  new PostgresAcademyRepository(db),
);

financeRouter.get(
  "/summary",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const managerUserId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;
      const summary = await financeService.getSummary(managerUserId, academyId);
      res.json(summary);
    } catch (e) {
      next(e);
    }
  },
);
