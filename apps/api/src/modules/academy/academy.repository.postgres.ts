import { and, count, eq, ilike } from "drizzle-orm";
import {
  academies,
  academyMemberships,
  classes,
  subscriptionPlans,
  type Database,
} from "@tatame/db";
import type { AcademyRow, IAcademyRepository } from "./academy.repository.js";
import type { RepoFactory } from "../../lib/repo-factory.js";

export class PostgresAcademyRepository implements IAcademyRepository {
  constructor(private readonly db: Database) {}

  async findById(academyId: string): Promise<AcademyRow | undefined> {
    const [row] = await this.db
      .select()
      .from(academies)
      .where(eq(academies.id, academyId))
      .limit(1);
    return row;
  }

  async searchByName(query: string, limit: number): Promise<AcademyRow[]> {
    return this.db
      .select()
      .from(academies)
      .where(ilike(academies.name, `%${query}%`))
      .limit(limit);
  }

  async create(data: {
    ownerId: string;
    name: string;
    logoUrl: string | null;
    address: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    foundedAt: string | null;
  }): Promise<AcademyRow> {
    const [row] = await this.db.insert(academies).values(data).returning();
    if (!row) throw new Error("Failed to create academy");
    return row;
  }

  async update(
    academyId: string,
    data: Partial<{
      name: string;
      logoUrl: string | null;
      address: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
      foundedAt: string | null;
    }>,
  ): Promise<AcademyRow | undefined> {
    const [row] = await this.db
      .update(academies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(academies.id, academyId))
      .returning();
    return row;
  }

  async updatePixKey(
    academyId: string,
    data: { pixKey: string | null; pixKeyType: string | null },
  ): Promise<AcademyRow | undefined> {
    const [row] = await this.db
      .update(academies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(academies.id, academyId))
      .returning();
    return row;
  }

  async existsByOwner(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: academies.id })
      .from(academies)
      .where(eq(academies.ownerId, userId))
      .limit(1);
    return !!row;
  }

  async getStats(academyId: string, currentDayOfWeek: number) {
    const [[membersRow], [pendingRow], [classesRow], [plansRow]] =
      await Promise.all([
        this.db
          .select({ c: count() })
          .from(academyMemberships)
          .where(
            and(
              eq(academyMemberships.academyId, academyId),
              eq(academyMemberships.status, "active"),
            ),
          ),
        this.db
          .select({ c: count() })
          .from(academyMemberships)
          .where(
            and(
              eq(academyMemberships.academyId, academyId),
              eq(academyMemberships.status, "pending"),
            ),
          ),
        this.db
          .select({ c: count() })
          .from(classes)
          .where(
            and(
              eq(classes.academyId, academyId),
              eq(classes.dayOfWeek, currentDayOfWeek),
              eq(classes.isActive, true),
            ),
          ),
        this.db
          .select({ c: count() })
          .from(subscriptionPlans)
          .where(
            and(
              eq(subscriptionPlans.academyId, academyId),
              eq(subscriptionPlans.isActive, true),
            ),
          ),
      ]);

    return {
      activeMembers: Number(membersRow?.c ?? 0),
      pendingRequests: Number(pendingRow?.c ?? 0),
      classesToday: Number(classesRow?.c ?? 0),
      activePlans: Number(plansRow?.c ?? 0),
    };
  }

  async withTransaction<T>(
    fn: (
      txRepo: IAcademyRepository,
      createRepo: <R>(factory: RepoFactory<R>) => R,
    ) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      const txDb = tx as unknown as Database;
      const txRepo = new PostgresAcademyRepository(txDb);
      const createRepo = <R>(factory: RepoFactory<R>): R => factory(txDb);
      return fn(txRepo, createRepo);
    });
  }
}
