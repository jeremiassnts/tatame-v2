import "express";
import type { Role } from "@tatame/types";

declare global {
  namespace Express {
    interface Request {
      appAuth?: { userId: string; role: Role };
      validatedBody?: unknown;
    }
  }
}

export {};
