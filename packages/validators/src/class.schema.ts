import { z } from "zod";

/** `HH:MM` or `HH:MM:SS` (Postgres time) */
export const classTimeStringSchema = z
  .string()
  .regex(
    /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
    "Expected time like 09:30 or 09:30:00",
  );

export const dayOfWeekSchema = z.number().int().min(0).max(6);

export const createClassBodySchema = z.object({
  instructorId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  dayOfWeek: dayOfWeekSchema,
  startTime: classTimeStringSchema,
  endTime: classTimeStringSchema,
  capacity: z.number().int().min(1).max(500).nullable().optional(),
});

export type CreateClassBody = z.infer<typeof createClassBodySchema>;

export const updateClassBodySchema = createClassBodySchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  });

export type UpdateClassBody = z.infer<typeof updateClassBodySchema>;

export const classIdParamSchema = z.object({
  classId: z.string().uuid(),
});

export const listClassesQuerySchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  includeInactive: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => v === "true" || v === "1"),
});
