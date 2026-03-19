import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import type { Role } from "@tatame/types";
import { loadEnv } from "@tatame/config";
import { getDb } from "../lib/db.js";
import { PostgresUserRepository } from "../modules/user/user.repository.postgres.js";
import { UserService } from "../modules/user/user.service.js";

const userService = new UserService(new PostgresUserRepository(getDb()));

/** Loads internal user id + active `user_roles` row; sets `req.appAuth` when allowed (spec §8). */
export function authorize(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      if (!loadEnv().CLERK_SECRET_KEY) {
        res
          .status(503)
          .json({ error: "Clerk is not configured (CLERK_SECRET_KEY)" });
        return;
      }
      const { userId: clerkUserId } = getAuth(req);
      if (!clerkUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      try {
        const userRow = await userService.getByClerkId(clerkUserId);
        if (!userRow) {
          res.status(403).json({ error: "User not provisioned" });
          return;
        }

        const activeRole = await userService.getActiveRole(userRow.id);
        if (!activeRole) {
          res.status(403).json({ error: "No active role; complete onboarding first" });
          return;
        }

        if (!allowed.includes(activeRole)) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }

        req.appAuth = { userId: userRow.id, role: activeRole };
        next();
      } catch (e) {
        next(e);
      }
    })();
  };
}
