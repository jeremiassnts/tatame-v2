import { Role } from "@tatame/types";
import type { CreateDependentBody, UpdateDependentBody } from "@tatame/validators";
import { createDependentBodySchema, updateDependentBodySchema } from "@tatame/validators";
import { Router } from "express";
import { getDb } from "../../lib/db.js";
import {
  attachActiveAcademyContext,
  requireActiveAcademy,
} from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { PostgresGraduationRepository } from "../graduation/graduation.repository.postgres.js";
import { PostgresStudentSubscriptionRepository } from "../subscription/subscription.repository.postgres.js";
import { PostgresDependentRepository } from "./dependent.repository.postgres.js";
import { DependentService } from "./dependent.service.js";

export const dependentRouter = Router();

const db = getDb();
const dependentService = new DependentService(
  new PostgresDependentRepository(db),
  new PostgresMembershipRepository(db),
  new PostgresGraduationRepository(db),
  new PostgresStudentSubscriptionRepository(db),
);

// POST /dependents - Register a dependent
dependentRouter.post(
  "/",
  authorize(Role.Guardian, Role.Student),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(createDependentBodySchema),
  async (req, res, next) => {
    try {
      const auth = req.appAuth!;
      const body = req.validatedBody as CreateDependentBody;
      const dependent = await dependentService.create({
        userId: auth.userId,
        role: auth.role,
        academyId: auth.activeAcademyId!,
        name: body.name,
        birthDate: body.birthDate,
        belt: body.belt,
        stripes: body.stripes,
      });
      res.status(201).json(dependent);
    } catch (e) {
      next(e);
    }
  },
);

// GET /dependents/me - List my dependents
dependentRouter.get(
  "/me",
  authorize(Role.Guardian, Role.Student),
  async (req, res, next) => {
    try {
      const result = await dependentService.listMine(req.appAuth!.userId);
      res.json({ items: result });
    } catch (e) {
      next(e);
    }
  },
);

// GET /dependents/academy/:academyId - List all academy dependents (manager only)
dependentRouter.get(
  "/academy/:academyId",
  authorize(Role.Manager),
  async (req, res, next) => {
    try {
      const { academyId } = req.params;
      if (!academyId) {
        res.status(400).json({ error: "academyId is required" });
        return;
      }
      const auth = req.appAuth!;
      const result = await dependentService.listByAcademy(
        auth.userId,
        auth.role,
        academyId,
      );
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

// GET /dependents/:id - Dependent detail
dependentRouter.get(
  "/:id",
  authorize(Role.Guardian, Role.Student, Role.Manager),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: "id is required" });
        return;
      }
      const auth = req.appAuth!;
      const result = await dependentService.getById(
        auth.userId,
        auth.role,
        id,
        auth.activeAcademyId ?? undefined,
      );
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

// PUT /dependents/:id - Edit dependent
dependentRouter.put(
  "/:id",
  authorize(Role.Guardian, Role.Student, Role.Manager),
  attachActiveAcademyContext,
  validateBody(updateDependentBodySchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: "id is required" });
        return;
      }
      const auth = req.appAuth!;
      const body = req.validatedBody as UpdateDependentBody;
      const result = await dependentService.update(
        auth.userId,
        auth.role,
        id,
        body,
        auth.activeAcademyId ?? undefined,
      );
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

// DELETE /dependents/:id - Soft delete dependent
dependentRouter.delete(
  "/:id",
  authorize(Role.Guardian, Role.Student, Role.Manager),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: "id is required" });
        return;
      }
      const auth = req.appAuth!;
      await dependentService.delete(
        auth.userId,
        auth.role,
        id,
        auth.activeAcademyId ?? undefined,
      );
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);
