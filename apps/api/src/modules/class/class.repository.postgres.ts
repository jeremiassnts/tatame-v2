import { and, eq } from "drizzle-orm";
import { classes, type Database } from "@tatame/db";
import type { ClassRow, IClassRepository } from "./class.repository.js";

export class PostgresClassRepository implements IClassRepository {
  constructor(private readonly db: Database) {}

  async findByAcademyId(
    academyId: string,
    filters: {
      dayOfWeek?: number;
      includeInactive?: boolean;
      instructorId?: string;
    },
  ): Promise<ClassRow[]> {
    const conditions = [eq(classes.academyId, academyId)];
    if (!filters.includeInactive) {
      conditions.push(eq(classes.isActive, true));
    }
    if (filters.dayOfWeek !== undefined) {
      conditions.push(eq(classes.dayOfWeek, filters.dayOfWeek));
    }
    if (filters.instructorId) {
      conditions.push(eq(classes.instructorId, filters.instructorId));
    }
    const whereClause =
      conditions.length === 1 ? conditions[0]! : and(...conditions);
    return this.db
      .select()
      .from(classes)
      .where(whereClause)
      .orderBy(classes.dayOfWeek, classes.startTime);
  }

  async findById(
    classId: string,
    academyId: string,
  ): Promise<ClassRow | undefined> {
    const [row] = await this.db
      .select()
      .from(classes)
      .where(and(eq(classes.id, classId), eq(classes.academyId, academyId)))
      .limit(1);
    return row;
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
    const [row] = await this.db.insert(classes).values(data).returning();
    if (!row) throw new Error("Failed to create class");
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
    const [row] = await this.db
      .update(classes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(classes.id, classId))
      .returning();
    return row;
  }
}
