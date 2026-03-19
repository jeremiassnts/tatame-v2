import { z } from "zod";

export const roleEnumSchema = z.enum(["manager", "instructor", "student"]);

export const setInitialRoleBodySchema = z.object({
  role: roleEnumSchema,
});

export type SetInitialRoleBody = z.infer<typeof setInitialRoleBodySchema>;

export const setInitialRoleResponseSchema = z.object({
  userId: z.string().uuid(),
  role: roleEnumSchema,
});

export type SetInitialRoleResponse = z.infer<typeof setInitialRoleResponseSchema>;

export const userMeResponseSchema = z.object({
  id: z.string().uuid(),
  clerkUserId: z.string(),
  email: z.string().email(),
  name: z.string(),
  profileImageUrl: z.string().nullable(),
  /** Null until `POST /users/me/role` (spec §8). */
  activeRole: roleEnumSchema.nullable(),
});

export type UserMeResponse = z.infer<typeof userMeResponseSchema>;
