import { z } from "zod";

export const planIdParamSchema = z.object({
  planId: z.string().uuid(),
});

export const recurrenceMonthsSchema = z.union([
  z.literal(1),
  z.literal(3),
  z.literal(6),
  z.literal(12),
]);

export const listPlansQuerySchema = z.object({
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export const createSubscriptionPlanBodySchema = z.object({
  name: z.string().min(1).max(200),
  recurrenceMonths: recurrenceMonthsSchema,
  priceCents: z.number().int().min(0),
  weeklyCheckinLimit: z.number().int().min(1).max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type CreateSubscriptionPlanBody = z.infer<
  typeof createSubscriptionPlanBodySchema
>;

export const updateSubscriptionPlanBodySchema =
  createSubscriptionPlanBodySchema.partial();

export type UpdateSubscriptionPlanBody = z.infer<
  typeof updateSubscriptionPlanBodySchema
>;

export const selectStudentPlanBodySchema = z.object({
  planId: z.string().uuid(),
});

export type SelectStudentPlanBody = z.infer<typeof selectStudentPlanBodySchema>;

export const listAcademySubscriptionsQuerySchema = z.object({
  status: z.enum(["active", "expired", "cancelled"]).optional(),
  planId: z.string().uuid().optional(),
  pendingPayment: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export type ListAcademySubscriptionsQuery = z.infer<
  typeof listAcademySubscriptionsQuerySchema
>;

export const subscriptionIdParamSchema = z.object({
  subscriptionId: z.string().uuid(),
});
