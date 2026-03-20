import { randomUUID } from "node:crypto";
import type { ClassRow, IClassRepository } from "./class.repository.js";

export class InMemoryClassRepository implements IClassRepository {
  constructor(private readonly rows: ClassRow[] = []) {}

  async findByAcademyId(
    academyId: string,
    filters: {
      dayOfWeek?: number;
      includeInactive?: boolean;
      instructorId?: string;
    },
  ): Promise<ClassRow[]> {
    return this.rows
      .filter((c) => c.academyId === academyId)
      .filter((c) => filters.includeInactive || c.isActive)
      .filter(
        (c) =>
          filters.dayOfWeek === undefined || c.dayOfWeek === filters.dayOfWeek,
      )
      .filter(
        (c) =>
          !filters.instructorId ||
          c.instructorId === filters.instructorId,
      )
      .sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return String(a.startTime).localeCompare(String(b.startTime));
      });
  }

  async findById(
    classId: string,
    academyId: string,
  ): Promise<ClassRow | undefined> {
    return this.rows.find(
      (c) => c.id === classId && c.academyId === academyId,
    );
  }

  async create(data: {
    academyId: string;
    instructorId: string;
    name: string;
    description: string | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    capacity: number | null;
    isActive: boolean;
  }): Promise<ClassRow> {
    const t = new Date();
    const row: ClassRow = {
      id: randomUUID(),
      ...data,
      createdAt: t,
      updatedAt: t,
    };
    this.rows.push(row);
    return row;
  }

  async update(
    classId: string,
    data: Partial<{
      name: string;
      description: string | null;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      capacity: number | null;
      instructorId: string;
      isActive: boolean;
    }>,
  ): Promise<ClassRow | undefined> {
    const row = this.rows.find((c) => c.id === classId);
    if (!row) return undefined;
    Object.assign(row, data, { updatedAt: new Date() });
    return row;
  }
}
