import type { NextFunction, Request, Response } from "express";
import { getDb } from "../lib/db.js";
import { PostgresMembershipRepository } from "../modules/membership/membership.repository.postgres.js";

const membershipRepo = new PostgresMembershipRepository(getDb());

/**
 * After `authorize`, loads `academy_memberships` where `is_active` and merges
 * `activeAcademyId` + `academyRole` into `req.appAuth`. No-op when there is
 * no active row (e.g. onboarding, requesting to join).
 */
export function attachActiveAcademyContext(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  void (async () => {
    const auth = req.appAuth;
    if (!auth) {
      next();
      return;
    }
    try {
      const row = await membershipRepo.findActiveByUser(auth.userId);
      if (row) {
        req.appAuth = {
          ...auth,
          activeAcademyId: row.academyId,
          academyRole: row.role,
        };
      }
      next();
    } catch (e) {
      next(e);
    }
  })();
}

/** Requires `attachActiveAcademyContext` (or equivalent) after `authorize`. */
export function requireActiveAcademy(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const id = req.appAuth?.activeAcademyId;
  if (!id) {
    res.status(403).json({ error: "No active academy membership" });
    return;
  }
  next();
}
