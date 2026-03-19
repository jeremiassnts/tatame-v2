import type { NextFunction, Request, Response } from "express";
import { CheckinLockBusyError } from "../lib/lock.js";
import { HttpError } from "../lib/http-error.js";
import { RedisUnavailableError } from "../lib/redis.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof RedisUnavailableError) {
    res.status(503).json({ error: err.message });
    return;
  }
  if (err instanceof CheckinLockBusyError) {
    res.status(429).json({ error: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : "Internal Server Error";
  res.status(500).json({ error: message });
}
