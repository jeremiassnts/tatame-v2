import { Router } from "express";
import { getAuth } from "@clerk/express";
import {
  setInitialRoleBodySchema,
  setInitialRoleResponseSchema,
  userMeResponseSchema,
} from "@tatame/validators";
import type { SetInitialRoleBody } from "@tatame/validators";
import { getDb } from "../../lib/db.js";
import { requireSession } from "../../middleware/require-session.js";
import { validateBody } from "../../middleware/validate.js";
import {
  assignInitialUserRole,
  getActiveRoleForUser,
  getUserByClerkId,
} from "./user.service.js";

export const userRouter = Router();

userRouter.get("/me", requireSession, async (req, res, next) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    if (!clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const db = getDb();
    const row = await getUserByClerkId(db, clerkUserId);

    if (!row) {
      res.status(404).json({
        error: "User not provisioned yet; wait for Clerk webhook sync",
      });
      return;
    }

    const activeRole = await getActiveRoleForUser(db, row.id);

    const body = {
      id: row.id,
      clerkUserId: row.clerkUserId,
      email: row.email,
      name: row.name,
      profileImageUrl: row.profileImageUrl,
      activeRole,
    };
    const parsed = userMeResponseSchema.safeParse(body);
    res.json(parsed.success ? parsed.data : body);
  } catch (e) {
    next(e);
  }
});

userRouter.post(
  "/me/role",
  requireSession,
  validateBody(setInitialRoleBodySchema),
  async (req, res, next) => {
    try {
      const { role } = req.validatedBody as SetInitialRoleBody;
      const { userId: clerkUserId } = getAuth(req);
      if (!clerkUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const db = getDb();
      const userRow = await getUserByClerkId(db, clerkUserId);
      if (!userRow) {
        res.status(404).json({
          error: "User not provisioned yet; wait for Clerk webhook sync",
        });
        return;
      }

      const created = await assignInitialUserRole(db, userRow.id, role);
      if (!created) {
        res.status(409).json({
          error: "Role already set; MVP does not allow switching roles",
        });
        return;
      }

      const payload = { userId: userRow.id, role };
      const parsed = setInitialRoleResponseSchema.safeParse(payload);
      res.status(201).json(parsed.success ? parsed.data : payload);
    } catch (e) {
      next(e);
    }
  },
);
