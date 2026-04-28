import { z } from "zod";

export const roleEnumSchema = z.enum(["manager", "instructor", "student"]);

export const syncUserBodySchema = z.object({
  role: roleEnumSchema.optional(),
});

export type SyncUserBody = z.infer<typeof syncUserBodySchema>;

export const updateProfileBodySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).nullable().optional(),
  instagram: z
    .string()
    .max(30)
    .transform((v) => v.replace(/^@/, ""))
    .nullable()
    .optional(),
  birthDate: z.string().date().nullable().optional(),
});

export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;

export const activeAcademySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  logoUrl: z.string().nullable(),
});

export type ActiveAcademy = z.infer<typeof activeAcademySchema>;

export const activeMembershipSchema = z.object({
  id: z.string().uuid(),
  academyId: z.string().uuid(),
  academyName: z.string(),
  academyLogoUrl: z.string().nullable(),
  role: roleEnumSchema,
  status: z.enum(["pending", "active", "blocked"]),
  joinedAt: z.coerce.date().nullable(),
});

export type ActiveMembership = z.infer<typeof activeMembershipSchema>;

export const userMeResponseSchema = z.object({
  id: z.string().uuid(),
  clerkUserId: z.string(),
  email: z.string().email(),
  name: z.string(),
  profileImageUrl: z.string().nullable(),
  phone: z.string().nullable(),
  instagram: z.string().nullable(),
  birthDate: z.string().nullable(),
  /** Null until a role is assigned via POST /users/me/sync. */
  activeRole: roleEnumSchema.nullable(),
  /** Non-null for managers who own an academy. */
  activeAcademy: activeAcademySchema.nullable(),
  /** Non-null for instructors/students with a pending or active membership. */
  activeMembership: activeMembershipSchema.nullable(),
  /** True when user has paid via Stripe but hasn't created an academy yet. */
  hasPendingSubscription: z.boolean().optional(),
});

export type UserMeResponse = z.infer<typeof userMeResponseSchema>;
