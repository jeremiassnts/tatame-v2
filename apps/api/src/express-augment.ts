import "express";
import type { Role } from "@tatame/types";

declare global {
  namespace Express {
    interface Request {
      appAuth?: {
        userId: string;
        role: Role;
        /** Set by `attachActiveAcademyContext` when `academy_memberships.is_active`. */
        activeAcademyId?: string;
        /** Role on the active membership row (may differ from global `role` in edge cases). */
        academyRole?: Role;
        managerPlan?: "free" | "pro";
        managerSubscriptionStatus?: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
      };
      validatedBody?: unknown;
    }
  }
}

export {};
