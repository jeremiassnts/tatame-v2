import { z } from "zod";

/** Calendar date of the class occurrence (YYYY-MM-DD), UTC per API convention. */
export const checkinSessionDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date as YYYY-MM-DD");

export const createCheckinBodySchema = z.object({
  classId: z.string().uuid(),
  date: checkinSessionDateSchema,
});

export type CreateCheckinBody = z.infer<typeof createCheckinBodySchema>;

export const checkinResponseSchema = z.object({
  id: z.string().uuid(),
  classId: z.string().uuid(),
  userId: z.string().uuid(),
  checkedInAt: z.string(),
  date: z.string(),
  weekReference: z.string(),
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
