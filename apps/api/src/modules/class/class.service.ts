import { and, eq, inArray } from "drizzle-orm";
import {
  academyMemberships,
  classes,
  type Database,
} from "@tatame/db";
import type { CreateClassBody, UpdateClassBody } from "@tatame/validators";
import type { Role } from "@tatame/types";
import { HttpError } from "../../lib/http-error.js";
import { assertManagerOwnsAcademy } from "../academy/academy.service.js";

function normalizeTime(t: string): string {
  const parts = t.split(":");
  const h = parts[0] ?? "0";
  const m = parts[1] ?? "0";
  if (parts.length === 2) return `${h.padStart(2, "0")}:${m}:00`;
  if (parts.length === 3) {
    const s = parts[2] ?? "00";
    return `${h.padStart(2, "0")}:${m}:${s}`;
  }
  return t;
}

function assertEndAfterStart(start: string, end: string): void {
  if (normalizeTime(end) <= normalizeTime(start)) {
    throw new HttpError(400, "endTime must be after startTime");
  }
}

async function assertUserCanTeachInAcademy(
  db: Database,
  academyId: string,
  userId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: academyMemberships.id })
    .from(academyMemberships)
    .where(
      and(
        eq(academyMemberships.academyId, academyId),
        eq(academyMemberships.userId, userId),
        eq(academyMemberships.isActive, true),
        eq(academyMemberships.status, "active"),
        inArray(academyMemberships.role, ["instructor", "manager"]),
      ),
    )
    .limit(1);
  if (!row) {
    throw new HttpError(
      400,
      "instructorId must be an active instructor or manager in this academy",
    );
  }
}

export type ClassAuthContext = {
  userId: string;
  role: Role;
  activeAcademyId: string;
};

export async function listClassesForActiveAcademy(
  db: Database,
  ctx: ClassAuthContext,
  query: { dayOfWeek?: number; includeInactive?: boolean },
) {
  const { activeAcademyId, role, userId } = ctx;

  const includeInactive =
    role === "manager" ? Boolean(query.includeInactive) : false;

  const conditions = [eq(classes.academyId, activeAcademyId)];

  if (!includeInactive) {
    conditions.push(eq(classes.isActive, true));
  }

  if (query.dayOfWeek !== undefined) {
    conditions.push(eq(classes.dayOfWeek, query.dayOfWeek));
  }

  if (role === "instructor") {
    conditions.push(eq(classes.instructorId, userId));
  }

  const whereClause =
    conditions.length === 1
      ? conditions[0]
      : and(...conditions);

  return db
    .select()
    .from(classes)
    .where(whereClause)
    .orderBy(classes.dayOfWeek, classes.startTime);
}

export async function getClassInActiveAcademy(
  db: Database,
  ctx: ClassAuthContext,
  classId: string,
) {
  const [row] = await db
    .select()
    .from(classes)
    .where(
      and(eq(classes.id, classId), eq(classes.academyId, ctx.activeAcademyId)),
    )
    .limit(1);

  if (!row) {
    throw new HttpError(404, "Class not found");
  }

  if (ctx.role === "student" && !row.isActive) {
    throw new HttpError(404, "Class not found");
  }

  if (ctx.role === "instructor" && row.instructorId !== ctx.userId) {
    throw new HttpError(403, "You can only view your own classes");
  }

  return row;
}

export async function createClass(
  db: Database,
  ctx: ClassAuthContext,
  body: CreateClassBody,
) {
  const { activeAcademyId, role, userId } = ctx;

  const startTime = normalizeTime(body.startTime);
  const endTime = normalizeTime(body.endTime);
  assertEndAfterStart(startTime, endTime);

  let instructorId = body.instructorId;

  if (role === "manager") {
    await assertManagerOwnsAcademy(db, userId, activeAcademyId);
    await assertUserCanTeachInAcademy(db, activeAcademyId, instructorId);
  } else if (role === "instructor") {
    if (instructorId !== userId) {
      throw new HttpError(403, "Instructors can only create classes for themselves");
    }
    await assertUserCanTeachInAcademy(db, activeAcademyId, userId);
  } else {
    throw new HttpError(403, "Forbidden");
  }

  const [created] = await db
    .insert(classes)
    .values({
      academyId: activeAcademyId,
      instructorId,
      name: body.name,
      description: body.description ?? null,
      dayOfWeek: body.dayOfWeek,
      startTime,
      endTime,
      capacity: body.capacity ?? null,
      isActive: true,
    })
    .returning();

  if (!created) {
    throw new HttpError(500, "Failed to create class");
  }
  return created;
}

async function loadClassForMutation(
  db: Database,
  ctx: ClassAuthContext,
  classId: string,
) {
  const row = await getClassInActiveAcademy(db, ctx, classId);
  if (ctx.role === "manager") {
    await assertManagerOwnsAcademy(db, ctx.userId, ctx.activeAcademyId);
  } else if (ctx.role === "instructor") {
    if (row.instructorId !== ctx.userId) {
      throw new HttpError(403, "You can only edit your own classes");
    }
  } else {
    throw new HttpError(403, "Forbidden");
  }
  return row;
}

export async function updateClass(
  db: Database,
  ctx: ClassAuthContext,
  classId: string,
  body: UpdateClassBody,
) {
  if (Object.keys(body).length === 0) {
    throw new HttpError(400, "At least one field is required");
  }

  const existing = await loadClassForMutation(db, ctx, classId);

  const startTime =
    body.startTime !== undefined
      ? normalizeTime(body.startTime)
      : String(existing.startTime);
  const endTime =
    body.endTime !== undefined
      ? normalizeTime(body.endTime)
      : String(existing.endTime);
  assertEndAfterStart(startTime, endTime);

  let nextInstructorId = existing.instructorId;
  if (body.instructorId !== undefined) {
    if (ctx.role === "instructor" && body.instructorId !== ctx.userId) {
      throw new HttpError(403, "Instructors cannot reassign the instructor");
    }
    nextInstructorId = body.instructorId;
    await assertUserCanTeachInAcademy(db, ctx.activeAcademyId, nextInstructorId);
  }

  if (ctx.role === "instructor" && body.isActive !== undefined) {
    throw new HttpError(403, "Only managers can change class active status");
  }

  const [updated] = await db
    .update(classes)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.dayOfWeek !== undefined ? { dayOfWeek: body.dayOfWeek } : {}),
      ...(body.startTime !== undefined ? { startTime } : {}),
      ...(body.endTime !== undefined ? { endTime } : {}),
      ...(body.capacity !== undefined ? { capacity: body.capacity } : {}),
      ...(body.instructorId !== undefined ? { instructorId: nextInstructorId } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      updatedAt: new Date(),
    })
    .where(eq(classes.id, classId))
    .returning();

  if (!updated) {
    throw new HttpError(404, "Class not found");
  }
  return updated;
}

export async function deactivateClass(
  db: Database,
  ctx: ClassAuthContext,
  classId: string,
) {
  await loadClassForMutation(db, ctx, classId);

  const [updated] = await db
    .update(classes)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(classes.id, classId))
    .returning();

  if (!updated) {
    throw new HttpError(404, "Class not found");
  }
  return updated;
}
