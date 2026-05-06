import type { NextFunction, Request, Response } from "express";
import { getDb } from "../lib/db.js";
import { PostgresManagerSubscriptionRepository } from "../modules/manager-subscription/manager-subscription.repository.postgres.js";

const subRepo = new PostgresManagerSubscriptionRepository(getDb());

export function requireActivePlan(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  void (async () => {
    const academyId = req.appAuth?.activeAcademyId;
    if (!academyId) {
      next();
      return;
    }

    if (req.appAuth?.role !== "manager") {
      next();
      return;
    }

    try {
      const sub = await subRepo.findByAcademyId(academyId);
      if (!sub) {
        res.status(403).json({
          error: "NO_SUBSCRIPTION",
          message: "Nenhuma conta encontrada.",
        });
        return;
      }

      if (
        sub.status === "active" ||
        sub.status === "trialing" ||
        sub.status === "incomplete"
      ) {
        req.appAuth = {
          ...req.appAuth,
          managerPlan: sub.plan,
          managerSubscriptionStatus: sub.status,
        };
        next();
        return;
      }

      res.status(403).json({
        error: "SUBSCRIPTION_BLOCKED",
        message: "Sua conta não tem acesso no momento.",
      });
    } catch (e) {
      next(e);
    }
  })();
}

