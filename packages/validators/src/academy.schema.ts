import { z } from "zod";

export const createAcademyBodySchema = z.object({
  name: z.string().min(1).max(200),
  logoUrl: z.string().url().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().max(50).nullable().optional(),
  foundedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export type CreateAcademyBody = z.infer<typeof createAcademyBodySchema>;

export const updateAcademyBodySchema = createAcademyBodySchema.partial();

export type UpdateAcademyBody = z.infer<typeof updateAcademyBodySchema>;

export const academyIdParamSchema = z.object({
  academyId: z.string().uuid(),
});

export const academyResponseSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  address: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  foundedAt: z.string().nullable(),
  pixKey: z.string().nullable(),
  pixKeyType: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type AcademyResponse = z.infer<typeof academyResponseSchema>;

export const academyStatsResponseSchema = z.object({
  activeMembers: z.number().int().min(0),
  pendingRequests: z.number().int().min(0),
  classesToday: z.number().int().min(0),
  activePlans: z.number().int().min(0),
});

export type AcademyStatsResponse = z.infer<typeof academyStatsResponseSchema>;

export const pixKeyTypeSchema = z.enum(["cpf", "email", "phone", "random"]);

export const updatePixKeyBodySchema = z.object({
  pixKeyType: pixKeyTypeSchema,
  pixKey: z.string().min(1).max(255),
});

export type UpdatePixKeyBody = z.infer<typeof updatePixKeyBodySchema>;
