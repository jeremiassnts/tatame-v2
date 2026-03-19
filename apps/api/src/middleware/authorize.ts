import type { NextFunction, Request, Response } from "express";
import type { Role } from "@tatame/types";

/** Role gate — full implementation uses user_roles + memberships (spec §8). */
export function authorize(..._allowed: Role[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.status(501).json({ error: "authorize() not implemented yet" });
  };
}
