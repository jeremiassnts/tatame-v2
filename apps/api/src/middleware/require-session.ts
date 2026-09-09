import { getAuth } from "@clerk/express";
import { loadEnv } from "@tatame/config";
import type { NextFunction, Request, Response } from "express";
import { emitEvent } from "../telemetry/events.js";

/** JSON 401 when there is no Clerk session (API-friendly; no browser redirects). */
export function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!loadEnv().CLERK_SECRET_KEY) {
    res.status(503).json({ error: "Clerk não configurado (CLERK_SECRET_KEY)" });
    return;
  }
  const { userId } = getAuth(req);
  if (!userId) {
    emitEvent("access.denied", { reason: "NO_SESSION", extra: { path: req.path } });
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
