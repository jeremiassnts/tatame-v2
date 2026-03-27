import { and, desc, eq } from "drizzle-orm";
import { beltPromotions, users, type Database } from "@tatame/db";
import type {
  BeltPromotionRow,
  BeltPromotionWithPromoterName,
  IGraduationRepository,
} from "./graduation.repository.js";

export class PostgresGraduationRepository implements IGraduationRepository {
  constructor(private readonly db: Database) {}

  async findCurrentByUserId(userId: string): Promise<BeltPromotionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(beltPromotions)
      .where(
        and(eq(beltPromotions.userId, userId), eq(beltPromotions.isCurrent, true)),
      )
      .limit(1);
    return row;
  }

  async listByUserInAcademy(
    userId: string,
    academyId: string,
  ): Promise<BeltPromotionWithPromoterName[]> {
    const rows = await this.db
      .select({
        id: beltPromotions.id,
        userId: beltPromotions.userId,
        academyId: beltPromotions.academyId,
        promotedBy: beltPromotions.promotedBy,
        promotedByName: users.name,
        belt: beltPromotions.belt,
        stripes: beltPromotions.stripes,
        isCurrent: beltPromotions.isCurrent,
        promotedAt: beltPromotions.promotedAt,
        notes: beltPromotions.notes,
      })
      .from(beltPromotions)
      .innerJoin(users, eq(users.id, beltPromotions.promotedBy))
      .where(
        and(
          eq(beltPromotions.userId, userId),
          eq(beltPromotions.academyId, academyId),
        ),
      )
      .orderBy(desc(beltPromotions.promotedAt));
    return rows;
  }

  async insertInitialCurrent(data: {
    userId: string;
    academyId: string;
    promotedBy: string;
    belt: string;
    stripes: number;
    notes: string | null;
  }): Promise<BeltPromotionRow> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: beltPromotions.id })
        .from(beltPromotions)
        .where(
          and(
            eq(beltPromotions.userId, data.userId),
            eq(beltPromotions.isCurrent, true),
          ),
        )
        .limit(1);
      if (existing) {
        throw new Error("GRADUATION_ALREADY_HAS_CURRENT");
      }
      const [row] = await tx
        .insert(beltPromotions)
        .values({
          userId: data.userId,
          academyId: data.academyId,
          promotedBy: data.promotedBy,
          belt: data.belt as BeltPromotionRow["belt"],
          stripes: data.stripes,
          isCurrent: true,
          notes: data.notes,
        })
        .returning();
      if (!row) throw new Error("Failed to insert belt promotion");
      return row;
    });
  }

  async replaceCurrentPromotion(data: {
    userId: string;
    academyId: string;
    promotedBy: string;
    belt: string;
    stripes: number;
    notes: string | null;
  }): Promise<BeltPromotionRow> {
    return this.db.transaction(async (tx) => {
      await tx
        .update(beltPromotions)
        .set({ isCurrent: false })
        .where(
          and(
            eq(beltPromotions.userId, data.userId),
            eq(beltPromotions.isCurrent, true),
          ),
        );
      const [row] = await tx
        .insert(beltPromotions)
        .values({
          userId: data.userId,
          academyId: data.academyId,
          promotedBy: data.promotedBy,
          belt: data.belt as BeltPromotionRow["belt"],
          stripes: data.stripes,
          isCurrent: true,
          notes: data.notes,
        })
        .returning();
      if (!row) throw new Error("Failed to insert belt promotion");
      return row;
    });
  }
}
