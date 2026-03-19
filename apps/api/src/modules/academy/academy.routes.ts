import { Router } from "express";
import { Role } from "@tatame/types";
import type { CreateAcademyBody, UpdateAcademyBody } from "@tatame/validators";
import {
  academyIdParamSchema,
  createAcademyBodySchema,
  updateAcademyBodySchema,
} from "@tatame/validators";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import { authorize } from "../../middleware/authorize.js";
import { requireSession } from "../../middleware/require-session.js";
import { validateBody } from "../../middleware/validate.js";
import {
  createAcademyWithManagerMembership,
  getAcademyById,
  searchAcademiesByName,
  updateAcademy,
} from "./academy.service.js";

export const academyRouter = Router();

academyRouter.get("/", requireSession, async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const db = getDb();
    const rows = await searchAcademiesByName(db, q);
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
    const db = getDb();
    const row = await getAcademyById(db, params.data.academyId);
    if (!row) {
      throw new HttpError(404, "Academy not found");
    }
    res.json(row);
  } catch (e) {
    next(e);
  }
});

academyRouter.post(
  "/",
  authorize(Role.Manager),
  validateBody(createAcademyBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as CreateAcademyBody;
      const userId = req.appAuth!.userId;
      const db = getDb();
      const created = await createAcademyWithManagerMembership(db, userId, body);
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  },
);

academyRouter.patch(
  "/:academyId",
  authorize(Role.Manager),
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
      const db = getDb();
      const updated = await updateAcademy(
        db,
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
