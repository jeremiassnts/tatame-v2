import { z } from "zod";

/** Calendar date of the class occurrence (YYYY-MM-DD), UTC per API convention. */
export const checkinSessionDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date as YYYY-MM-DD");

export const createCheckinBodySchema = z.object({
  classId: z.string().uuid(),
  date: checkinSessionDateSchema,
  dependentId: z.string().uuid().optional(),
});

export type CreateCheckinBody = z.infer<typeof createCheckinBodySchema>;

export const checkinResponseSchema = z.object({
  id: z.string().uuid(),
  classId: z.string().uuid(),
  userId: z.string().uuid(),
  checkedInAt: z.string(),
  date: z.string(),
  weekReference: z.string(),
  /** Set when the check-in was taken for a dependent; null for the caller's own. */
  dependentId: z.string().uuid().nullable(),
});

export const createCheckinResponseSchema = z.object({
  checkin: checkinResponseSchema,
  warnings: z
    .object({
      subscriptionGrace: z.literal(true).optional(),
      paymentOverdue: z.literal(true).optional(),
    })
    .optional(),
});

export type CreateCheckinResponse = z.infer<typeof createCheckinResponseSchema>;

export const checkinHistoryQuerySchema = z.object({
  cursor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 4)),
});

export type CheckinHistoryQuery = z.infer<typeof checkinHistoryQuerySchema>;
