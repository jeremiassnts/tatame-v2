import type { NextFunction, Request, Response } from "express";

/**
 * Clerk JWT verification — placeholder until @clerk/backend is wired.
 * Attaches a stub context in development when CLERK_SECRET_KEY is unset.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (process.env.CLERK_SECRET_KEY) {
    res.status(501).json({ error: "Clerk auth not implemented yet" });
    return;
  }
  (req as Request & { auth?: { userId: string } }).auth = undefined;
  next();
}
