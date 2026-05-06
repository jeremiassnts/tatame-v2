import type { CreateClassBody, UpdateClassBody } from "@tatame/validators";
import type { Role } from "@tatame/types";
import { HttpError } from "../../lib/http-error.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { IManagerSubscriptionRepository } from "../manager-subscription/manager-subscription.repository.js";
import { FREE_PLAN_LIMITS } from "../manager-subscription/plan-limits.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { NotificationDispatcher } from "../notification/notification-dispatcher.js";
import type { IClassRepository } from "./class.repository.js";

export type ClassAuthContext = {
  userId: string;
  role: Role;
  activeAcademyId: string;
};

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

export class ClassService {
  constructor(
    private readonly classRepo: IClassRepository,
    private readonly membershipRepo: IMembershipRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly dispatcher?: NotificationDispatcher,
    private readonly managerSubRepo?: IManagerSubscriptionRepository,
  ) {}

  async list(
    ctx: ClassAuthContext,
    query: { dayOfWeek?: number; includeInactive?: boolean },
  ) {
    const includeInactive =
      ctx.role === "manager" ? Boolean(query.includeInactive) : false;
    return this.classRepo.findByAcademyId(ctx.activeAcademyId, {
      dayOfWeek: query.dayOfWeek,
      includeInactive,
    });
  }

  async getById(ctx: ClassAuthContext, classId: string) {
    const row = await this.classRepo.findById(classId, ctx.activeAcademyId);
    if (!row) throw new HttpError(404, "Class not found");
    if (ctx.role === "student" && !row.isActive) {
      throw new HttpError(404, "Class not found");
    }
    if (
      ctx.role === "instructor" &&
      row.instructorId !== ctx.userId &&
      !row.isActive
    ) {
      throw new HttpError(404, "Class not found");
    }
    return row;
  }

  async create(ctx: ClassAuthContext, body: CreateClassBody) {
    const startTime = normalizeTime(body.startTime);
    const endTime = normalizeTime(body.endTime);
    assertEndAfterStart(startTime, endTime);

    // Plan limit enforcement
    if (this.managerSubRepo) {
      const sub = await this.managerSubRepo.findByAcademyId(ctx.activeAcademyId);
      if (sub?.plan === "free") {
        const existing = await this.classRepo.findByAcademyId(ctx.activeAcademyId, {
          dayOfWeek: body.dayOfWeek,
          includeInactive: false,
        });
        if (existing.length >= FREE_PLAN_LIMITS.maxClassesPerDay) {
          throw new HttpError(403, "Limite de aulas por dia atingido para o plano atual", {
            code: "PLAN_LIMIT_CLASSES",
          });
        }
      }
    }

    if (ctx.role === "manager") {
      await this.assertManagerOwnsAcademy(ctx.userId, ctx.activeAcademyId);
      await this.assertCanTeach(ctx.activeAcademyId, body.instructorId);
    } else if (ctx.role === "instructor") {
      if (body.instructorId !== ctx.userId) {
        throw new HttpError(403, "Instructors can only create classes for themselves");
      }
      await this.assertCanTeach(ctx.activeAcademyId, ctx.userId);
    } else {
      throw new HttpError(403, "Forbidden");
    }

    const created = await this.classRepo.create({
      academyId: ctx.activeAcademyId,
      instructorId: body.instructorId,
      name: body.name,
      description: body.description ?? null,
      dayOfWeek: body.dayOfWeek,
      startTime,
      endTime,
      capacity: body.capacity ?? null,
      isActive: true,
    });

    if (this.dispatcher) {
      const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
      const dayName = dayNames[body.dayOfWeek] ?? "";
      const timeFormatted = startTime.slice(0, 5);
      this.dispatcher.notifyAcademyStudents(
        "class_created",
        ctx.activeAcademyId,
        [body.name, dayName, timeFormatted],
      );
    }

    return created;
  }

  async update(ctx: ClassAuthContext, classId: string, body: UpdateClassBody) {
    if (Object.keys(body).length === 0) {
      throw new HttpError(400, "At least one field is required");
    }

    const existing = await this.loadForMutation(ctx, classId);

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
      await this.assertCanTeach(ctx.activeAcademyId, nextInstructorId);
    }

    if (ctx.role === "instructor" && body.isActive !== undefined) {
      throw new HttpError(403, "Only managers can change class active status");
    }

    const updated = await this.classRepo.update(classId, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.dayOfWeek !== undefined ? { dayOfWeek: body.dayOfWeek } : {}),
      ...(body.startTime !== undefined ? { startTime } : {}),
      ...(body.endTime !== undefined ? { endTime } : {}),
      ...(body.capacity !== undefined ? { capacity: body.capacity } : {}),
      ...(body.instructorId !== undefined ? { instructorId: nextInstructorId } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    });

    if (!updated) {
      throw new HttpError(404, "Class not found");
    }

    if (this.dispatcher && (body.startTime !== undefined || body.endTime !== undefined || body.dayOfWeek !== undefined)) {
      this.dispatcher.notifyAcademyStudents(
        "class_updated",
        ctx.activeAcademyId,
        [updated.name],
      );
    }

    return updated;
  }

  async deactivate(ctx: ClassAuthContext, classId: string) {
    const existing = await this.loadForMutation(ctx, classId);

    const updated = await this.classRepo.update(classId, { isActive: false });
    if (!updated) {
      throw new HttpError(404, "Class not found");
    }

    if (this.dispatcher) {
      this.dispatcher.notifyAcademyStudents(
        "class_deactivated",
        ctx.activeAcademyId,
        [existing.name],
      );
    }

    return updated;
  }

  private async loadForMutation(ctx: ClassAuthContext, classId: string) {
    const row = await this.getById(ctx, classId);
    if (ctx.role === "manager") {
      await this.assertManagerOwnsAcademy(ctx.userId, ctx.activeAcademyId);
    } else if (ctx.role === "instructor") {
      if (row.instructorId !== ctx.userId) {
        throw new HttpError(403, "You can only edit your own classes");
      }
    } else {
      throw new HttpError(403, "Forbidden");
    }
    return row;
  }

  private async assertManagerOwnsAcademy(userId: string, academyId: string) {
    const academy = await this.academyRepo.findById(academyId);
    if (!academy) throw new HttpError(404, "Academy not found");
    if (academy.ownerId !== userId) {
      throw new HttpError(403, "You do not manage this academy");
    }
  }

  private async assertCanTeach(academyId: string, userId: string) {
    const m = await this.membershipRepo.findActiveByUserAndAcademy(
      userId,
      academyId,
    );
    if (!m || !["instructor", "manager"].includes(m.role)) {
      throw new HttpError(
        400,
        "instructorId must be an active instructor or manager in this academy",
      );
    }
  }
}
