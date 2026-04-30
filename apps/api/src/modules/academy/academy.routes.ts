import { Role } from "@tatame/types";
import type {
  CreateAcademyBody,
  UpdateAcademyBody,
  UpdatePixKeyBody,
} from "@tatame/validators";
import {
  academyIdParamSchema,
  createAcademyBodySchema,
  updateAcademyBodySchema,
  updatePixKeyBodySchema,
} from "@tatame/validators";
import { Router } from "express";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import {
  attachActiveAcademyContext,
  requireActiveAcademy,
} from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { requireSession } from "../../middleware/require-session.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresManagerSubscriptionRepository } from "../manager-subscription/manager-subscription.repository.postgres.js";
import { ManagerSubscriptionService } from "../manager-subscription/manager-subscription.service.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { getStripe } from "../../lib/stripe.js";
import { PostgresAcademyRepository } from "./academy.repository.postgres.js";
import { AcademyService } from "./academy.service.js";

export const academyRouter = Router();

const db = getDb();
const academyRepo = new PostgresAcademyRepository(db);
const userRepo = new PostgresUserRepository(db);
const subRepo = new PostgresManagerSubscriptionRepository(db);

function getManagerSubService() {
  let stripe = null;
  try { stripe = getStripe(); } catch { /* Stripe not configured */ }
  return new ManagerSubscriptionService(subRepo, academyRepo, stripe);
}

const academyService = new AcademyService(
  academyRepo,
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

      // Link any pending Stripe subscription to the new academy
      await getManagerSubService().linkPendingSubscription(userId, created.id, userRepo);

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

academyRouter.put(
  "/pix-key",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(updatePixKeyBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as UpdatePixKeyBody;
      const academyId = req.appAuth!.activeAcademyId!;
      const userId = req.appAuth!.userId;

      const academy = await academyService.getById(academyId);
      if (!academy || academy.ownerId !== userId) {
        throw new HttpError(403, "You do not manage this academy");
      }

      const updated = await new PostgresAcademyRepository(db).updatePixKey(
        academyId,
        { pixKey: body.pixKey, pixKeyType: body.pixKeyType },
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

academyRouter.delete(
  "/pix-key",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const academyId = req.appAuth!.activeAcademyId!;
      const userId = req.appAuth!.userId;

      const academy = await academyService.getById(academyId);
      if (!academy || academy.ownerId !== userId) {
        throw new HttpError(403, "You do not manage this academy");
      }

      const updated = await new PostgresAcademyRepository(db).updatePixKey(
        academyId,
        { pixKey: null, pixKeyType: null },
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);
