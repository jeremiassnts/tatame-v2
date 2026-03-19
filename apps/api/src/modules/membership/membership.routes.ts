import { Router } from "express";
import { Role } from "@tatame/types";
import type { RequestMembershipBody } from "@tatame/validators";
import {
  membershipIdParamSchema,
  pendingQuerySchema,
  requestMembershipBodySchema,
} from "@tatame/validators";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import { attachActiveAcademyContext } from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresAcademyRepository } from "../academy/academy.repository.postgres.js";
import { PostgresMembershipRepository } from "./membership.repository.postgres.js";
import { MembershipService } from "./membership.service.js";

export const membershipRouter = Router();

const db = getDb();
const membershipService = new MembershipService(
  new PostgresMembershipRepository(db),
  new PostgresAcademyRepository(db),
);

membershipRouter.post(
  "/requests",
  authorize(Role.Instructor, Role.Student),
  attachActiveAcademyContext,
  validateBody(requestMembershipBodySchema),
  async (req, res, next) => {
    try {
      const { academyId } = req.validatedBody as RequestMembershipBody;
      const userId = req.appAuth!.userId;
      const role = req.appAuth!.role;
      const created = await membershipService.request(
        userId,
        role as "instructor" | "student",
        academyId,
      );
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.get(
  "/pending",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const query = pendingQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new HttpError(400, "Query academyId (uuid) is required");
      }
      const managerUserId = req.appAuth!.userId;
      const items = await membershipService.listPending(
        query.data.academyId,
        managerUserId,
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.patch(
  "/:membershipId/approve",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }
      const updated = await membershipService.approve(
        params.data.membershipId,
        req.appAuth!.userId,
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.patch(
  "/:membershipId/reject",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }
      const updated = await membershipService.reject(
        params.data.membershipId,
        req.appAuth!.userId,
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.patch(
  "/:membershipId/block",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }
      const updated = await membershipService.block(
        params.data.membershipId,
        req.appAuth!.userId,
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.patch(
  "/:membershipId/unblock",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }
      await membershipService.unblock(
        params.data.membershipId,
        req.appAuth!.userId,
      );
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.post(
  "/leave",
  authorize(Role.Instructor, Role.Student),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const updated = await membershipService.leave(req.appAuth!.userId);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);
