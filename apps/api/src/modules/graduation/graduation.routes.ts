import { Router } from "express";
import { Role } from "@tatame/types";
import type {
  PromoteBeltBody,
  RegisterInitialBeltBody,
} from "@tatame/validators";
import {
  listGraduationsQuerySchema,
  promoteBeltBodySchema,
  registerInitialBeltBodySchema,
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
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { PostgresGraduationRepository } from "./graduation.repository.postgres.js";
import { GraduationService } from "./graduation.service.js";

export const graduationRouter = Router();

const db = getDb();
const graduationService = new GraduationService(
  new PostgresGraduationRepository(db),
  new PostgresMembershipRepository(db),
  new PostgresAcademyRepository(db),
);

function formatPromotion(row: {
  id: string;
  userId: string;
  academyId: string;
  promotedBy: string;
  promotedByName?: string;
  belt: string;
  stripes: number;
  isCurrent: boolean;
  promotedAt: Date;
  notes: string | null;
}) {
  return {
    id: row.id,
    userId: row.userId,
    academyId: row.academyId,
    promotedBy: row.promotedBy,
    promotedByName: row.promotedByName ?? "",
    belt: row.belt,
    stripes: row.stripes,
    isCurrent: row.isCurrent,
    promotedAt: row.promotedAt.toISOString(),
    notes: row.notes ?? null,
  };
}

graduationRouter.get(
  "/me",
  authorize(Role.Student, Role.Manager, Role.Instructor),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const userId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;
      const items = await graduationService.listForUserInAcademy(
        userId,
        academyId,
      );
      res.json({ items: items.map(formatPromotion) });
    } catch (e) {
      next(e);
    }
  },
);

graduationRouter.post(
  "/initial",
  authorize(Role.Student, Role.Manager, Role.Instructor),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(registerInitialBeltBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as RegisterInitialBeltBody;
      const row = await graduationService.registerInitialBelt({
        userId: req.appAuth!.userId,
        academyId: req.appAuth!.activeAcademyId!,
        belt: body.belt,
        stripes: body.stripes,
        notes: body.notes ?? null,
        globalRole: req.appAuth!.role,
      });
      res.status(201).json(formatPromotion(row));
    } catch (e) {
      next(e);
    }
  },
);

graduationRouter.get(
  "/",
  authorize(Role.Manager, Role.Instructor),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const query = listGraduationsQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new HttpError(400, "Invalid query (userId required)");
      }
      const academyId = req.appAuth!.activeAcademyId!;
      const actorId = req.appAuth!.userId;
      const actorRole = req.appAuth!.role;
      await graduationService.assertStaffCanListMember(
        actorId,
        actorRole,
        academyId,
        query.data.userId,
      );
      const items = await graduationService.listForUserInAcademy(
        query.data.userId,
        academyId,
      );
      res.json({ items: items.map(formatPromotion) });
    } catch (e) {
      next(e);
    }
  },
);

graduationRouter.post(
  "/",
  authorize(Role.Manager, Role.Instructor),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(promoteBeltBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as PromoteBeltBody;
      const row = await graduationService.promoteMember({
        actorUserId: req.appAuth!.userId,
        actorRole: req.appAuth!.role,
        academyId: req.appAuth!.activeAcademyId!,
        targetUserId: body.userId,
        belt: body.belt,
        stripes: body.stripes,
        notes: body.notes ?? null,
      });
      res.status(201).json(formatPromotion(row));
    } catch (e) {
      next(e);
    }
  },
);
