import { eq, and, isNull } from "drizzle-orm";
import { dependents } from "@tatame/db";
import type { Database } from "@tatame/db";
import type { DependentRow, IDependentRepository } from "./dependent.repository.js";

export class PostgresDependentRepository implements IDependentRepository {
  constructor(private readonly db: Database) {}

  async insert(data: {
    guardianId: string;
    academyId: string;
    name: string;
    birthDate: string;
  }): Promise<DependentRow> {
    const [row] = await this.db
      .insert(dependents)
      .values({
        guardianId: data.guardianId,
        academyId: data.academyId,
        name: data.name,
        birthDate: data.birthDate,
      })
      .returning();
    return row!;
  }

  async findById(id: string): Promise<DependentRow | undefined> {
    const [row] = await this.db
      .select()
      .from(dependents)
      .where(and(eq(dependents.id, id), isNull(dependents.deletedAt)));
    return row;
  }

  async findByGuardian(guardianId: string): Promise<DependentRow[]> {
    return this.db
      .select()
      .from(dependents)
      .where(and(eq(dependents.guardianId, guardianId), isNull(dependents.deletedAt)));
  }

  async findByAcademy(academyId: string): Promise<DependentRow[]> {
    return this.db
      .select()
      .from(dependents)
      .where(and(eq(dependents.academyId, academyId), isNull(dependents.deletedAt)));
  }

  async update(id: string, data: {
    name?: string;
    birthDate?: string;
  }): Promise<DependentRow | undefined> {
    const [row] = await this.db
      .update(dependents)
      .set(data)
      .where(and(eq(dependents.id, id), isNull(dependents.deletedAt)))
      .returning();
    return row;
  }

  async softDelete(id: string): Promise<void> {
    await this.db
      .update(dependents)
      .set({ deletedAt: new Date() })
      .where(and(eq(dependents.id, id), isNull(dependents.deletedAt)));
  }

  async softDeleteByGuardianAndAcademy(guardianId: string, academyId: string): Promise<void> {
    await this.db
      .update(dependents)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(dependents.guardianId, guardianId),
          eq(dependents.academyId, academyId),
          isNull(dependents.deletedAt),
        ),
      );
  }
}
