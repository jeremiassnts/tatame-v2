import { eq, ilike } from "drizzle-orm";
import { academies, type Database } from "@tatame/db";
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
