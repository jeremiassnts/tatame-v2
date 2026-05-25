import { and, desc, eq, isNull } from "drizzle-orm";
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
        and(
          eq(beltPromotions.userId, userId),
          eq(beltPromotions.isCurrent, true),
          isNull(beltPromotions.dependentId),
        ),
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
        dependentId: beltPromotions.dependentId,
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
          isNull(beltPromotions.dependentId),
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
    dependentId?: string | null;
  }): Promise<BeltPromotionRow> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: beltPromotions.id })
        .from(beltPromotions)
        .where(
          and(
            eq(beltPromotions.userId, data.userId),
            eq(beltPromotions.isCurrent, true),
            data.dependentId
              ? eq(beltPromotions.dependentId, data.dependentId)
              : isNull(beltPromotions.dependentId),
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
          dependentId: data.dependentId ?? null,
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
    dependentId?: string | null;
  }): Promise<BeltPromotionRow> {
    return this.db.transaction(async (tx) => {
      await tx
        .update(beltPromotions)
        .set({ isCurrent: false })
        .where(
          and(
            eq(beltPromotions.userId, data.userId),
            eq(beltPromotions.isCurrent, true),
            data.dependentId
              ? eq(beltPromotions.dependentId, data.dependentId)
              : isNull(beltPromotions.dependentId),
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
          dependentId: data.dependentId ?? null,
        })
        .returning();
      if (!row) throw new Error("Failed to insert belt promotion");
      return row;
    });
  }

  async findCurrentByDependentId(dependentId: string): Promise<BeltPromotionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(beltPromotions)
      .where(
        and(
          eq(beltPromotions.dependentId, dependentId),
          eq(beltPromotions.isCurrent, true),
        ),
      )
      .limit(1);
    return row;
  }

  async listByDependentInAcademy(
    dependentId: string,
    academyId: string,
  ): Promise<BeltPromotionRow[]> {
    return this.db
      .select()
      .from(beltPromotions)
      .where(
        and(
          eq(beltPromotions.dependentId, dependentId),
          eq(beltPromotions.academyId, academyId),
        ),
      )
      .orderBy(desc(beltPromotions.promotedAt));
  }
}
