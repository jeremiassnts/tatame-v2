import type { InferSelectModel } from "drizzle-orm";
import type { beltPromotions } from "@tatame/db";

export type BeltPromotionRow = InferSelectModel<typeof beltPromotions>;

export type BeltPromotionWithPromoterName = BeltPromotionRow & {
  promotedByName: string;
};

export interface IGraduationRepository {
  findCurrentByUserId(userId: string): Promise<BeltPromotionRow | undefined>;

  listByUserInAcademy(
    userId: string,
    academyId: string,
  ): Promise<BeltPromotionWithPromoterName[]>;

  insertInitialCurrent(data: {
    userId: string;
    academyId: string;
    promotedBy: string;
    belt: string;
    stripes: number;
    notes: string | null;
    dependentId?: string | null;
  }): Promise<BeltPromotionRow>;

  /** Clears `is_current` for the user and inserts the new current row (spec §6.10). */
  replaceCurrentPromotion(data: {
    userId: string;
    academyId: string;
    promotedBy: string;
    belt: string;
    stripes: number;
    notes: string | null;
    dependentId?: string | null;
  }): Promise<BeltPromotionRow>;

  findCurrentByDependentId(dependentId: string): Promise<BeltPromotionRow | undefined>;

  listByDependentInAcademy(
    dependentId: string,
    academyId: string,
  ): Promise<BeltPromotionWithPromoterName[]>;
}
