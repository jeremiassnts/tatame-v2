import { getAuth } from "@clerk/express";
import { loadEnv } from "@tatame/config";
import type { NextFunction, Request, Response } from "express";
import { getClerkClient } from "../lib/clerk.js";

/**
 * Middleware that restricts access to the platform admin.
 * Validates the authenticated Clerk user's email against ADMIN_EMAIL env var.
 */
export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    const env = loadEnv();
    if (!env.CLERK_SECRET_KEY || !env.ADMIN_EMAIL) {
      res.status(503).json({ error: "Admin not configured" });
      return;
    }

    const { userId: clerkUserId } = getAuth(req);
    if (!clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const clerk = getClerkClient();
      const clerkUser = await clerk.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress;

      if (!email || email !== env.ADMIN_EMAIL) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      next();
    } catch (e) {
      next(e);
    }
  })();
}
