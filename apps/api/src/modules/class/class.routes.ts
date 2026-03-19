import { Router, type Request } from "express";
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
import {
  createClass,
  deactivateClass,
  getClassInActiveAcademy,
  listClassesForActiveAcademy,
  updateClass,
} from "./class.service.js";

export const classRouter = Router();

function classCtx(req: Request) {
  const a = req.appAuth!;
  return {
    userId: a.userId,
    role: a.role,
    activeAcademyId: a.activeAcademyId!,
  };
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
      const db = getDb();
      const items = await listClassesForActiveAcademy(db, classCtx(req), query.data);
      res.json({ items });
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
      const db = getDb();
      const row = await getClassInActiveAcademy(
        db,
        classCtx(req),
        params.data.classId,
      );
      res.json(row);
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
      const db = getDb();
      const created = await createClass(db, classCtx(req), body);
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
      const db = getDb();
      const updated = await updateClass(
        db,
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
      const db = getDb();
      const updated = await deactivateClass(
        db,
        classCtx(req),
        params.data.classId,
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);
