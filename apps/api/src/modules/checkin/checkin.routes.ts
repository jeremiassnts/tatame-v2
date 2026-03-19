import { Router } from "express";
import { Role } from "@tatame/types";
import type { CreateCheckinBody } from "@tatame/validators";
import { createCheckinBodySchema } from "@tatame/validators";
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
import { PostgresPaymentRepository } from "../payment/payment.repository.postgres.js";
import { PostgresStudentSubscriptionRepository } from "../subscription/subscription.repository.postgres.js";
import { PostgresCheckinRepository } from "./checkin.repository.postgres.js";
import type { CheckinRow } from "./checkin.repository.js";
import { CheckinService } from "./checkin.service.js";

export const checkinRouter = Router();

const db = getDb();
const checkinService = new CheckinService(
  new PostgresMembershipRepository(db),
  new PostgresClassRepository(db),
  new PostgresStudentSubscriptionRepository(db),
  new PostgresPaymentRepository(db),
  new PostgresCheckinRepository(db),
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
