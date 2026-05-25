import { z } from "zod";
import { Belt } from "@tatame/types";
import { MAX_STRIPES_BY_BELT } from "@tatame/config";

const beltValues = [
  Belt.White,
  Belt.Blue,
  Belt.Purple,
  Belt.Brown,
  Belt.Black,
  Belt.GreyWhite,
  Belt.Grey,
  Belt.GreyBlack,
  Belt.YellowWhite,
  Belt.Yellow,
  Belt.YellowBlack,
  Belt.OrangeWhite,
  Belt.Orange,
  Belt.OrangeBlack,
  Belt.GreenWhite,
  Belt.Green,
  Belt.GreenBlack,
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
    dependentId: z.string().uuid().optional(),
  })
  .superRefine(refineBeltStripes);

export type RegisterInitialBeltBody = z.infer<
  typeof registerInitialBeltBodySchema
>;

export const promoteBeltBodySchema = z
  .object({
    userId: z.string().uuid(),
    belt: beltSchema,
    stripes: z.number().int(),
    notes: z.string().max(2000).nullable().optional(),
    dependentId: z.string().uuid().optional(),
  })
  .superRefine(refineBeltStripes);

export type PromoteBeltBody = z.infer<typeof promoteBeltBodySchema>;

export const listGraduationsQuerySchema = z.object({
  userId: z.string().uuid(),
  dependentId: z.string().uuid().optional(),
});

export type ListGraduationsQuery = z.infer<typeof listGraduationsQuerySchema>;

export const beltPromotionResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  academyId: z.string().uuid(),
  promotedBy: z.string().uuid(),
  promotedByName: z.string(),
  belt: beltSchema,
  stripes: z.number().int(),
  isCurrent: z.boolean(),
  promotedAt: z.string(),
  notes: z.string().nullable(),
});

export type BeltPromotionResponse = z.infer<typeof beltPromotionResponseSchema>;
