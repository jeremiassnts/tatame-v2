import { Role } from "@tatame/types";
import type { CreateAcademyBody, UpdateAcademyBody } from "@tatame/validators";
import {
  academyIdParamSchema,
  createAcademyBodySchema,
  updateAcademyBodySchema,
} from "@tatame/validators";
import { Router } from "express";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import { attachActiveAcademyContext } from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { requireSession } from "../../middleware/require-session.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { PostgresAcademyRepository } from "./academy.repository.postgres.js";
import { AcademyService } from "./academy.service.js";

export const academyRouter = Router();

const db = getDb();
const academyService = new AcademyService(
  new PostgresAcademyRepository(db),
  (txDb) => new PostgresMembershipRepository(txDb),
);

academyRouter.get("/", requireSession, async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const rows = await academyService.searchByName(q);
    res.json({ items: rows });
  } catch (e) {
    next(e);
  }
});

academyRouter.get("/:academyId", requireSession, async (req, res, next) => {
  try {
    const params = academyIdParamSchema.safeParse(req.params);
    if (!params.success) {
      throw new HttpError(400, "Invalid academy id");
    }
    const row = await academyService.getById(params.data.academyId);
    if (!row) {
      throw new HttpError(404, "Academy not found");
    }
    res.json(row);
  } catch (e) {
    next(e);
  }
});

academyRouter.get(
  "/:academyId/stats",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const params = academyIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid academy id");
      }
      const userId = req.appAuth!.userId;
      const stats = await academyService.getStats(
        params.data.academyId,
        userId,
      );
      res.json(stats);
    } catch (e) {
      next(e);
    }
  },
);

academyRouter.post(
  "/",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  validateBody(createAcademyBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as CreateAcademyBody;
      const userId = req.appAuth!.userId;
      const created = await academyService.createWithManagerMembership(userId, body);
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  },
);

academyRouter.patch(
  "/:academyId",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  validateBody(updateAcademyBodySchema),
  async (req, res, next) => {
    try {
      const params = academyIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid academy id");
      }
      const body = req.validatedBody as UpdateAcademyBody;
      if (Object.keys(body).length === 0) {
        throw new HttpError(400, "At least one field is required");
      }
      const userId = req.appAuth!.userId;
      const updated = await academyService.update(
        params.data.academyId,
        userId,
        body,
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);
