import { z } from "zod";

/** Billing period anchor: first calendar day of the month (YYYY-MM-01). */
export const referenceMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date YYYY-MM-DD")
  .refine((s) => s.endsWith("-01"), {
    message: "referenceMonth must be the first day of the month (e.g. 2026-03-01)",
  });

export const confirmManualPaymentBodySchema = z.object({
  subscriptionId: z.string().uuid(),
  amountCents: z.number().int().min(0),
  referenceMonth: referenceMonthSchema,
  notes: z.string().max(2000).nullable().optional(),
  /** ISO 8601 datetime; defaults to server time if omitted */
  paidAt: z.string().datetime({ offset: true }).optional(),
});

export type ConfirmManualPaymentBody = z.infer<
  typeof confirmManualPaymentBodySchema
>;

export const listPaymentsQuerySchema = z.object({
  subscriptionId: z.string().uuid().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().min(1).max(100).optional()),
});
