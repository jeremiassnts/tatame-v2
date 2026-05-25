import { Router } from "express";
import { getAuth } from "@clerk/express";
import { Role } from "@tatame/types";
import { registerPushTokenBodySchema } from "@tatame/validators";
import type { RegisterPushTokenBody } from "@tatame/validators";
import { getDb } from "../../lib/db.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresPushTokenRepository } from "./push-token.repository.postgres.js";
import { PushTokenService } from "./push-token.service.js";

export const pushTokenRouter = Router();

const db = getDb();
const pushTokenService = new PushTokenService(
  new PostgresPushTokenRepository(db),
);

/**
 * `authorize` sets `req.appAuth.userId` to the internal DB uuid,
 * but `push_tokens.userId` references `users.clerk_user_id`.
 * Use Clerk's `getAuth` to get the Clerk user ID for token storage.
 */
pushTokenRouter.post(
  "/",
  authorize(Role.Manager, Role.Instructor, Role.Student, Role.Guardian),
  validateBody(registerPushTokenBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as RegisterPushTokenBody;
      const { userId: clerkId } = getAuth(req);
      if (!clerkId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const row = await pushTokenService.register({
        userId: clerkId,
        token: body.token,
        platform: body.platform,
        deviceId: body.deviceId,
      });
      res.status(201).json({
        id: row.id,
        platform: row.platform,
        deviceId: row.deviceId,
        createdAt: row.createdAt.toISOString(),
      });
    } catch (e) {
      next(e);
    }
  },
);

pushTokenRouter.delete(
  "/:deviceId",
  authorize(Role.Manager, Role.Instructor, Role.Student, Role.Guardian),
  async (req, res, next) => {
    try {
      const { userId: clerkId } = getAuth(req);
      if (!clerkId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { deviceId } = req.params;
      if (!deviceId) {
        res.status(400).json({ error: "deviceId is required" });
        return;
      }
      await pushTokenService.unregister(clerkId, deviceId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  },
);
