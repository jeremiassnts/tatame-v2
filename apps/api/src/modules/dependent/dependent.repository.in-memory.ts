import { randomUUID } from "node:crypto";
import type { DependentRow, IDependentRepository } from "./dependent.repository.js";

export class InMemoryDependentRepository implements IDependentRepository {
  constructor(private readonly rows: DependentRow[] = []) {}

  async insert(data: {
    guardianId: string;
    academyId: string;
    name: string;
    birthDate: string;
  }): Promise<DependentRow> {
    const t = new Date();
    const row: DependentRow = {
      id: randomUUID(),
      guardianId: data.guardianId,
      academyId: data.academyId,
      name: data.name,
      birthDate: data.birthDate,
      createdAt: t,
      updatedAt: t,
      deletedAt: null,
    };
    this.rows.push(row);
    return row;
  }

  async findById(id: string): Promise<DependentRow | undefined> {
    return this.rows.find((r) => r.id === id && r.deletedAt === null);
  }

  async findByGuardian(guardianId: string): Promise<DependentRow[]> {
    return this.rows.filter(
      (r) => r.guardianId === guardianId && r.deletedAt === null,
    );
  }

  async findByAcademy(academyId: string): Promise<DependentRow[]> {
    return this.rows.filter(
      (r) => r.academyId === academyId && r.deletedAt === null,
    );
  }

  async update(
    id: string,
    data: { name?: string; birthDate?: string },
  ): Promise<DependentRow | undefined> {
    const row = this.rows.find((r) => r.id === id && r.deletedAt === null);
    if (!row) return undefined;
    if (data.name !== undefined) row.name = data.name;
    if (data.birthDate !== undefined) row.birthDate = data.birthDate;
    row.updatedAt = new Date();
    return row;
  }

  async softDelete(id: string): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.deletedAt = new Date();
  }

  async softDeleteByGuardianAndAcademy(
    guardianId: string,
    academyId: string,
  ): Promise<void> {
    const t = new Date();
    for (const row of this.rows) {
      if (
        row.guardianId === guardianId &&
        row.academyId === academyId &&
        row.deletedAt === null
      ) {
        row.deletedAt = t;
      }
    }
  }
}
