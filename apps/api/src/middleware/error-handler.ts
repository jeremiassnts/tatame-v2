import type { NextFunction, Request, Response } from "express";
import { CheckinLockBusyError } from "../lib/lock.js";
import { HttpError } from "../lib/http-error.js";
import { RedisUnavailableError } from "../lib/redis.js";
import { recordAppError } from "../telemetry/error-capture.js";
import { emitEvent } from "../telemetry/events.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      error: err.details?.code ?? err.message,
      message: err.message,
    });
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
  // Only this branch. The 4xx above are expected outcomes the domains already
  // report through their own `*.rejected` events; this is the one that means the
  // service broke.
  emitEvent("request.failed", { err });
  // Only this branch is genuinely our failure, so only this one is worth a
  // stack on the span. The 4xx cases above are expected outcomes.
  if (err instanceof Error) recordAppError(res, err);
  const message = err instanceof Error ? err.message : "Internal Server Error";
  res.status(500).json({ error: message });
}
