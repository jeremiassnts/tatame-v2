import { z } from "zod";
import { Belt } from "@tatame/types";
import { MAX_STRIPES_BY_BELT } from "@tatame/config";

const beltValues = [
  Belt.White,
  Belt.Blue,
  Belt.Purple,
  Belt.Brown,
  Belt.Black,
] as const;

export const beltSchema = z.enum(beltValues);

function refineBeltStripes(
  data: { belt: (typeof beltValues)[number]; stripes: number },
  ctx: z.RefinementCtx,
) {
  const max = MAX_STRIPES_BY_BELT[data.belt];
  if (data.stripes < 0 || data.stripes > max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Stripes must be between 0 and ${max} for ${data.belt} belt`,
      path: ["stripes"],
    });
  }
}

export const registerInitialBeltBodySchema = z
  .object({
    belt: beltSchema,
    stripes: z.number().int(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .superRefine(refineBeltStripes);

export type RegisterInitialBeltBody = z.infer<
  typeof registerInitialBeltBodySchema
>;

export const promoteStudentBeltBodySchema = z
  .object({
    studentUserId: z.string().uuid(),
    belt: beltSchema,
    stripes: z.number().int(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .superRefine(refineBeltStripes);

export type PromoteStudentBeltBody = z.infer<
  typeof promoteStudentBeltBodySchema
>;

export const listGraduationsQuerySchema = z.object({
  userId: z.string().uuid(),
});

export type ListGraduationsQuery = z.infer<typeof listGraduationsQuerySchema>;

export const beltPromotionResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  academyId: z.string().uuid(),
  promotedBy: z.string().uuid(),
  belt: beltSchema,
  stripes: z.number().int(),
  isCurrent: z.boolean(),
  promotedAt: z.string(),
  notes: z.string().nullable(),
});

export type BeltPromotionResponse = z.infer<typeof beltPromotionResponseSchema>;
