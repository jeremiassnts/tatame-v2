import { getAuth } from "@clerk/express";
import { loadEnv } from "@tatame/config";
import type { Role } from "@tatame/types";
import type { NextFunction, Request, Response } from "express";
import { getDb } from "../lib/db.js";
import { PostgresUserRepository } from "../modules/user/user.repository.postgres.js";
import { UserService } from "../modules/user/user.service.js";
import { emitEvent } from "../telemetry/events.js";

const userService = new UserService(new PostgresUserRepository(getDb()));

/** Loads internal user id + active `user_roles` row; sets `req.appAuth` when allowed (spec §8). */
export function authorize(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      if (!loadEnv().CLERK_SECRET_KEY) {
        res
          .status(503)
          .json({ error: "Clerk não configurado (CLERK_SECRET_KEY)" });
        return;
      }
      const { userId: clerkUserId } = getAuth(req);
      if (!clerkUserId) {
        emitEvent("access.denied", { reason: "NO_SESSION", extra: { path: req.path } });
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      try {
        const userRow = await userService.getByClerkId(clerkUserId);
        if (!userRow) {
          emitEvent("access.denied", {
            reason: "ROLE_FORBIDDEN",
            clerkUserId,
            extra: { path: req.path, cause: "not_provisioned" },
          });
          res.status(403).json({ error: "User not provisioned" });
          return;
        }

        const activeRole = await userService.getActiveRole(userRow.id);
        if (!activeRole) {
          emitEvent("access.denied", {
            reason: "ROLE_FORBIDDEN",
            userId: userRow.id,
            extra: { path: req.path, cause: "no_active_role" },
          });
          res.status(403).json({ error: "No active role; complete onboarding first" });
          return;
        }

        if (!allowed.includes(activeRole)) {
          emitEvent("access.denied", {
            reason: "ROLE_FORBIDDEN",
            userId: userRow.id,
            actorRole: activeRole,
            extra: { path: req.path, cause: "role_not_allowed", allowed: allowed.join(",") },
          });
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
