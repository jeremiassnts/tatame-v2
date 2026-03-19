import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

/** Attach validated body to req — expand to query/params when routes need it */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    (req as Request & { validatedBody: T }).validatedBody = parsed.data;
    next();
  };
}
