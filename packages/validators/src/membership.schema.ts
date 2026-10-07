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

/**
 * `guardian` belongs here: `academy_memberships.role` is the full app role
 * enum and a guardian holds a membership like anyone else. Leaving it out made
 * every `role === "guardian"` check in the app dead code the compiler could not
 * flag as reachable — which is how the manager's member screen stopped showing
 * a guardian's dependents.
 */
export const membershipResponseSchema = z.object({
  id: z.string().uuid(),
  academyId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["manager", "instructor", "student", "guardian"]),
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

export const listMembersQuerySchema = z.object({
  role: z.enum(["instructor", "student", "guardian", "dependent"]).optional(),
  status: z.enum(["pending", "active", "blocked"]).optional(),
  q: z.string().optional(),
});

export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;

export const memberListItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["manager", "instructor", "student", "guardian"]),
  status: z.enum(["pending", "active", "rejected", "blocked"]),
  joinedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  userName: z.string(),
  userEmail: z.string().email(),
  userProfileImageUrl: z.string().nullable(),
  currentBelt: z
    .enum(["white", "blue", "purple", "brown", "black"])
    .nullable(),
  currentStripes: z.number().int().min(0).max(10).nullable(),
});

export type MemberListItem = z.infer<typeof memberListItemSchema>;

export const memberDetailResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["manager", "instructor", "student", "guardian"]),
  status: z.enum(["pending", "active", "rejected", "blocked"]),
  joinedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  userName: z.string(),
  userEmail: z.string().email(),
  userPhone: z.string().nullable(),
  userInstagram: z.string().nullable(),
  userBirthDate: z.string().nullable(),
  userProfileImageUrl: z.string().nullable(),
  history: z.array(
    z.object({
      id: z.string().uuid(),
      role: z.enum(["manager", "instructor", "student", "guardian"]),
      status: z.enum(["pending", "active", "rejected", "blocked"]),
      joinedAt: z.coerce.date().nullable(),
      leftAt: z.coerce.date().nullable(),
      createdAt: z.coerce.date(),
    })
  ),
});

export type MemberDetailResponse = z.infer<typeof memberDetailResponseSchema>;
