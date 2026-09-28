import type { NextFunction, Request, Response } from "express";
import { getDb } from "../lib/db.js";
import { PostgresManagerSubscriptionRepository } from "../modules/manager-subscription/manager-subscription.repository.postgres.js";
import { emitEvent } from "../telemetry/events.js";

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
        emitEvent("access.denied", {
          reason: "PLAN_REQUIRED",
          academyId,
          extra: { path: req.path, cause: "no_subscription" },
        });
        res.status(403).json({
          error: "NO_SUBSCRIPTION",
          message: "Nenhuma conta encontrada.",
        });
        return;
      }

      // `incomplete` means Stripe never got a successful payment for the
      // subscription — a declined card lands here. Letting it through was the
      // second way an unpaid account reached the manager panel. The gap between
      // checkout and webhook confirmation is covered by `trialing`, which is
      // what a completed checkout produces given the 30-day trial.
      if (sub.status === "active" || sub.status === "trialing") {
        req.appAuth = {
          ...req.appAuth,
          managerPlan: sub.plan,
          managerSubscriptionStatus: sub.status,
        };
        next();
        return;
      }

      emitEvent("access.denied", {
        reason: "PLAN_REQUIRED",
        academyId,
        extra: { path: req.path, cause: "subscription_blocked", status: sub.status },
      });
      res.status(403).json({
        error: "SUBSCRIPTION_BLOCKED",
        message: "Sua conta não tem acesso no momento.",
      });
    } catch (e) {
      next(e);
    }
  })();
}

