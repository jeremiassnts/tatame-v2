import { randomUUID } from "node:crypto";
import type { RepoFactory } from "../../lib/repo-factory.js";
import type { InMemoryMembershipRepository } from "../membership/membership.repository.in-memory.js";
import type { AcademyRow, IAcademyRepository } from "./academy.repository.js";

export class InMemoryAcademyRepository implements IAcademyRepository {
  constructor(
    private readonly rows: AcademyRow[] = [],
    /**
     * Same instance used by `AcademyService` factory so `withTransaction` + `createRepo`
     * mutate the membership store used in tests.
     */
    private readonly membershipForTx: InMemoryMembershipRepository | null = null,
  ) {}

  async findById(academyId: string): Promise<AcademyRow | undefined> {
    return this.rows.find((a) => a.id === academyId);
  }

  async searchByName(query: string, limit: number): Promise<AcademyRow[]> {
    const q = query.trim().toLowerCase();
    return this.rows
      .filter((a) => a.name.toLowerCase().includes(q))
      .slice(0, limit);
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
    const t = new Date();
    const row: AcademyRow = {
      id: randomUUID(),
      ownerId: data.ownerId,
      name: data.name,
      logoUrl: data.logoUrl,
      address: data.address,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      foundedAt: data.foundedAt,
      createdAt: t,
      updatedAt: t,
    };
    this.rows.push(row);
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
    const row = this.rows.find((a) => a.id === academyId);
    if (!row) return undefined;
    Object.assign(row, data, { updatedAt: new Date() });
    return row;
  }

  async existsByOwner(userId: string): Promise<boolean> {
    return this.rows.some((a) => a.ownerId === userId);
  }

  async withTransaction<T>(
    fn: (
      txRepo: IAcademyRepository,
      createRepo: <R>(factory: RepoFactory<R>) => R,
    ) => Promise<T>,
  ): Promise<T> {
    if (!this.membershipForTx) {
      throw new Error(
        "InMemoryAcademyRepository: pass InMemoryMembershipRepository for withTransaction tests",
      );
    }
    const membership = this.membershipForTx;
    const createRepo = <R>(_factory: RepoFactory<R>): R => membership as R;
    return fn(this, createRepo);
  }
}
