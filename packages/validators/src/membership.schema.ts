import { z } from "zod";

export const requestMembershipBodySchema = z.object({
  academyId: z.string().uuid(),
});

export type RequestMembershipBody = z.infer<typeof requestMembershipBodySchema>;

export const membershipIdParamSchema = z.object({
  membershipId: z.string().uuid(),
});

export const pendingQuerySchema = z.object({
  academyId: z.string().uuid(),
});

export const membershipResponseSchema = z.object({
  id: z.string().uuid(),
  academyId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["manager", "instructor", "student"]),
  status: z.enum(["pending", "active", "rejected", "blocked"]),
  isActive: z.boolean(),
  joinedAt: z.coerce.date().nullable(),
  leftAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type MembershipResponse = z.infer<typeof membershipResponseSchema>;

export const pendingMembershipItemSchema = membershipResponseSchema.extend({
  userName: z.string(),
  userEmail: z.string().email(),
});

export type PendingMembershipItem = z.infer<typeof pendingMembershipItemSchema>;
