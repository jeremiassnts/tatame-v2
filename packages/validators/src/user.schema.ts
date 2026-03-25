import { z } from "zod";

export const roleEnumSchema = z.enum(["manager", "instructor", "student"]);

export const syncUserBodySchema = z.object({
  role: roleEnumSchema.optional(),
});

export type SyncUserBody = z.infer<typeof syncUserBodySchema>;

export const activeAcademySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  logoUrl: z.string().nullable(),
});

export type ActiveAcademy = z.infer<typeof activeAcademySchema>;

export const userMeResponseSchema = z.object({
  id: z.string().uuid(),
  clerkUserId: z.string(),
  email: z.string().email(),
  name: z.string(),
  profileImageUrl: z.string().nullable(),
  /** Null until a role is assigned via POST /users/me/sync. */
  activeRole: roleEnumSchema.nullable(),
  /** Non-null for managers who own an academy. */
  activeAcademy: activeAcademySchema.nullable(),
});

export type UserMeResponse = z.infer<typeof userMeResponseSchema>;
