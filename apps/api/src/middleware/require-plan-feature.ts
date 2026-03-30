import type { NextFunction, Request, Response } from "express";

export type PlanFeature =
  | "approve_student"
  | "approve_instructor"
  | "create_plan"
  | "create_class";

export function requirePlanFeature(_feature: PlanFeature) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    next();
  };
}

