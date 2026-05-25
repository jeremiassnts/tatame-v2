import { randomUUID } from "node:crypto";
import type {
  BeltPromotionRow,
  BeltPromotionWithPromoterName,
  IGraduationRepository,
} from "./graduation.repository.js";

export class InMemoryGraduationRepository implements IGraduationRepository {
  constructor(private readonly rows: BeltPromotionRow[] = []) {}

  async findCurrentByUserId(userId: string): Promise<BeltPromotionRow | undefined> {
    return this.rows.find((r) => r.userId === userId && r.isCurrent);
  }

  async listByUserInAcademy(
    userId: string,
    academyId: string,
  ): Promise<BeltPromotionWithPromoterName[]> {
    return this.rows
      .filter((r) => r.userId === userId && r.academyId === academyId)
      .sort(
        (a, b) =>
          new Date(b.promotedAt).getTime() - new Date(a.promotedAt).getTime(),
      )
      .map((r) => ({ ...r, promotedByName: "Test User" }));
  }

  async insertInitialCurrent(data: {
    userId: string;
    academyId: string;
    promotedBy: string;
    belt: string;
    stripes: number;
    notes: string | null;
  }): Promise<BeltPromotionRow> {
    const hasCurrent = this.rows.some(
      (r) => r.userId === data.userId && r.isCurrent,
    );
    if (hasCurrent) {
      throw new Error("GRADUATION_ALREADY_HAS_CURRENT");
    }
    const t = new Date();
    const row: BeltPromotionRow = {
      id: randomUUID(),
      userId: data.userId,
      academyId: data.academyId,
      promotedBy: data.promotedBy,
      dependentId: null,
      belt: data.belt as BeltPromotionRow["belt"],
      stripes: data.stripes,
      isCurrent: true,
      promotedAt: t,
      notes: data.notes,
    };
    this.rows.push(row);
    return row;
  }

  async replaceCurrentPromotion(data: {
    userId: string;
    academyId: string;
    promotedBy: string;
    belt: string;
    stripes: number;
    notes: string | null;
  }): Promise<BeltPromotionRow> {
    for (const r of this.rows) {
      if (r.userId === data.userId && r.isCurrent) {
        r.isCurrent = false;
      }
    }
    const t = new Date();
    const row: BeltPromotionRow = {
      id: randomUUID(),
      userId: data.userId,
      academyId: data.academyId,
      promotedBy: data.promotedBy,
      dependentId: null,
      belt: data.belt as BeltPromotionRow["belt"],
      stripes: data.stripes,
      isCurrent: true,
      promotedAt: t,
      notes: data.notes,
    };
    this.rows.push(row);
    return row;
  }
}
