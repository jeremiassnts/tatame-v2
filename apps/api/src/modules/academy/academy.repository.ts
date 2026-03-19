import type { InferSelectModel } from "drizzle-orm";
import type { academies } from "@tatame/db";
import type { RepoFactory } from "../../lib/repo-factory.js";

export type AcademyRow = InferSelectModel<typeof academies>;

export interface IAcademyRepository {
  findById(academyId: string): Promise<AcademyRow | undefined>;

  searchByName(query: string, limit: number): Promise<AcademyRow[]>;

  create(data: {
    ownerId: string;
    name: string;
    logoUrl: string | null;
    address: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    foundedAt: string | null;
  }): Promise<AcademyRow>;

  update(
    academyId: string,
    data: Partial<{
      name: string;
      logoUrl: string | null;
      address: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
      foundedAt: string | null;
    }>,
  ): Promise<AcademyRow | undefined>;

  withTransaction<T>(
    fn: (
      txRepo: IAcademyRepository,
      createRepo: <R>(factory: RepoFactory<R>) => R,
    ) => Promise<T>,
  ): Promise<T>;
}
