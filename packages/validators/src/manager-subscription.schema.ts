import { z } from "zod";

export const managerSubscriptionResponseSchema = z.object({
  id: z.string().uuid(),
  academyId: z.string().uuid(),
  plan: z.enum(["free", "pro"]),
  status: z.enum(["active", "past_due", "canceled", "incomplete"]),
  stripeCustomerId: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  subscribedAt: z.string(),
  canceledAt: z.string().nullable(),
});

export type ManagerSubscriptionResponse = z.infer<
  typeof managerSubscriptionResponseSchema
>;

export const managerLimitsResponseSchema = z.object({
  students: z.object({ used: z.number(), limit: z.number().nullable() }),
  plans: z.object({ used: z.number(), limit: z.number().nullable() }),
  schedulesPerDay: z.object({
    maxUsed: z.number(),
    limit: z.number().nullable(),
  }),
  instructors: z.object({ allowed: z.boolean() }),
  blocked: z.boolean(),
  plan: z.enum(["free", "pro"]),
});

export type ManagerLimitsResponse = z.infer<typeof managerLimitsResponseSchema>;

export const stripePortalResponseSchema = z.object({
  url: z.string().url(),
});

export const stripeCheckoutResponseSchema = z.object({
  clientSecret: z.string(),
  subscriptionId: z.string(),
});

