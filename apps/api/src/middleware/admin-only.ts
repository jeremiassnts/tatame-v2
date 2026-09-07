import { loadEnv } from "@tatame/config";
import type { NextFunction, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";

type AdminTokenPayload = { role?: string; exp?: number };

function verifyAdminToken(token: string, secret: string): boolean {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !signatureB64) return false;

    const expected = createHmac("sha256", secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");

    if (expected.length !== signatureB64.length) return false;
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signatureB64))) return false;

    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString(),
    ) as AdminTokenPayload;
    if (payload.role !== "admin") return false;
    if (payload.exp && Date.now() / 1000 > payload.exp) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Middleware that restricts access to the platform admin.
 * Validates a simple JWT signed with ADMIN_JWT_SECRET.
 */
export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  const env = loadEnv();
  if (!env.ADMIN_JWT_SECRET) {
    res.status(503).json({ error: "Admin not configured" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  if (!verifyAdminToken(token, env.ADMIN_JWT_SECRET)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}
