import type { InferSelectModel } from "drizzle-orm";
import type { dependents } from "@tatame/db";

export type DependentRow = InferSelectModel<typeof dependents>;

export interface IDependentRepository {
  insert(data: {
    guardianId: string;
    academyId: string;
    name: string;
    birthDate: string;
  }): Promise<DependentRow>;

  findById(id: string): Promise<DependentRow | undefined>;

  findByGuardian(guardianId: string): Promise<DependentRow[]>;

  findByAcademy(academyId: string): Promise<DependentRow[]>;

  update(id: string, data: {
    name?: string;
    birthDate?: string;
  }): Promise<DependentRow | undefined>;

  softDelete(id: string): Promise<void>;

  softDeleteByGuardianAndAcademy(guardianId: string, academyId: string): Promise<void>;
}
