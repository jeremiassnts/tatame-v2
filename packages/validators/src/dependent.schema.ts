import { z } from "zod";

export const createDependentBodySchema = z.object({
  name: z.string().min(2).max(100),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date as YYYY-MM-DD"),
  belt: z.enum([
    "white",
    "grey_white",
    "grey",
    "grey_black",
    "yellow_white",
    "yellow",
    "yellow_black",
    "orange_white",
    "orange",
    "orange_black",
    "green_white",
    "green",
    "green_black",
  ]),
  stripes: z.number().int().min(0).max(4),
});

export type CreateDependentBody = z.infer<typeof createDependentBodySchema>;

export const updateDependentBodySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date as YYYY-MM-DD").optional(),
});

export type UpdateDependentBody = z.infer<typeof updateDependentBodySchema>;

export const dependentResponseSchema = z.object({
  id: z.string().uuid(),
  guardianId: z.string().uuid(),
  academyId: z.string().uuid(),
  name: z.string(),
  birthDate: z.string(),
  currentBelt: z
    .object({
      belt: z.string(),
      stripes: z.number(),
    })
    .nullable(),
  subscriptionStatus: z.enum(["active", "expired", "none"]).nullable(),
  createdAt: z.string(),
});

export type DependentResponse = z.infer<typeof dependentResponseSchema>;
