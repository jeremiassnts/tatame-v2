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
import { authorize } from "../../middleware/authorize.js";
import { requireSession } from "../../middleware/require-session.js";
import { validateBody } from "../../middleware/validate.js";
import {
  approveMembership,
  blockMembership,
  leaveActiveMembership,
  listPendingMembershipsForAcademy,
  rejectMembership,
  requestMembership,
  unblockMembership,
} from "./membership.service.js";

export const membershipRouter = Router();

membershipRouter.post(
  "/requests",
  authorize(Role.Instructor, Role.Student),
  validateBody(requestMembershipBodySchema),
  async (req, res, next) => {
    try {
      const { academyId } = req.validatedBody as RequestMembershipBody;
      const userId = req.appAuth!.userId;
      const role = req.appAuth!.role;
      const db = getDb();
      const created = await requestMembership(
        db,
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
  async (req, res, next) => {
    try {
      const query = pendingQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new HttpError(400, "Query academyId (uuid) is required");
      }
      const managerUserId = req.appAuth!.userId;
      const db = getDb();
      const items = await listPendingMembershipsForAcademy(
        db,
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
  async (req, res, next) => {
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }
      const db = getDb();
      const updated = await approveMembership(
        db,
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
  async (req, res, next) => {
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }
      const db = getDb();
      const updated = await rejectMembership(
        db,
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
  async (req, res, next) => {
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }
      const db = getDb();
      const updated = await blockMembership(
        db,
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
  async (req, res, next) => {
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }
      const db = getDb();
      await unblockMembership(
        db,
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
  async (req, res, next) => {
    try {
      const db = getDb();
      const updated = await leaveActiveMembership(db, req.appAuth!.userId);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);
