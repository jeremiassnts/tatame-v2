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
          error: "Nenhuma assinatura encontrada. Selecione um plano.",
          code: "NO_SUBSCRIPTION",
        });
        return;
      }

      if (sub.status === "active" || sub.status === "incomplete") {
        req.appAuth = {
          ...req.appAuth,
          managerPlan: sub.plan,
          managerSubscriptionStatus: sub.status,
        };
        next();
        return;
      }

      res.status(403).json({
        error:
          sub.status === "past_due"
            ? "Seu pagamento está atrasado. Atualize seus dados de pagamento para continuar usando o app."
            : "Sua assinatura foi cancelada. Reative o plano Pro para continuar usando o app.",
        code: "SUBSCRIPTION_BLOCKED",
      });
    } catch (e) {
      next(e);
    }
  })();
}

