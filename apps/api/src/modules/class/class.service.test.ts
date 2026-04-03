import { randomUUID } from "node:crypto";
import type { Role } from "@tatame/types";
import { describe, expect, it } from "vitest";
import {
  makeAcademy,
  makeClass,
  makeMembership,
} from "../../testing/factories/index.js";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import { InMemoryMembershipRepository } from "../membership/membership.repository.in-memory.js";
import type { MembershipRow } from "../membership/membership.repository.js";
import { InMemoryClassRepository } from "./class.repository.in-memory.js";
import type { ClassRow } from "./class.repository.js";
import { ClassService } from "./class.service.js";

describe("ClassService", () => {
  function setup() {
    const academyId = randomUUID();
    const managerId = randomUUID();
    const instructorId = randomUUID();
    const academy = makeAcademy({ id: academyId, ownerId: managerId });
    const classRows: ClassRow[] = [];
    const memRows: MembershipRow[] = [
      makeMembership({
        userId: managerId,
        academyId,
        role: "manager",
        status: "active",
        isActive: true,
      }),
      makeMembership({
        userId: instructorId,
        academyId,
        role: "instructor",
        status: "active",
        isActive: true,
      }),
    ];
    const svc = new ClassService(
      new InMemoryClassRepository(classRows),
      new InMemoryMembershipRepository(memRows),
      new InMemoryAcademyRepository([academy]),
    );
    return {
      svc,
      academyId,
      managerId,
      instructorId,
      classRows,
    };
  }

  const ctx = (userId: string, role: Role, academyId: string) => ({
    userId,
    role,
    activeAcademyId: academyId,
  });

  it("manager creates class for instructor in same academy", async () => {
    const { svc, academyId, managerId, instructorId, classRows } = setup();
    const created = await svc.create(ctx(managerId, "manager", academyId), {
      instructorId,
      name: "Fundamentals",
      dayOfWeek: 2,
      startTime: "18:00",
      endTime: "19:00",
    });
    expect(created.instructorId).toBe(instructorId);
    expect(classRows).toHaveLength(1);
  });

  it("rejects endTime before startTime", async () => {
    const { svc, academyId, managerId, instructorId } = setup();
    await expect(
      svc.create(ctx(managerId, "manager", academyId), {
        instructorId,
        name: "Bad",
        dayOfWeek: 1,
        startTime: "19:00",
        endTime: "18:00",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("student cannot create", async () => {
    const { svc, academyId, instructorId } = setup();
    const studentId = randomUUID();
    await expect(
      svc.create(ctx(studentId, "student", academyId), {
        instructorId,
        name: "X",
        dayOfWeek: 1,
        startTime: "10:00",
        endTime: "11:00",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("instructor list includes classes taught by other instructors", async () => {
    const academyId = randomUUID();
    const managerId = randomUUID();
    const instructorA = randomUUID();
    const instructorB = randomUUID();
    const academy = makeAcademy({ id: academyId, ownerId: managerId });
    const classA = makeClass({
      academyId,
      instructorId: instructorA,
      name: "Mine",
      isActive: true,
    });
    const classB = makeClass({
      academyId,
      instructorId: instructorB,
      name: "Theirs",
      isActive: true,
    });
    const memRows: MembershipRow[] = [
      makeMembership({
        userId: managerId,
        academyId,
        role: "manager",
        status: "active",
        isActive: true,
      }),
      makeMembership({
        userId: instructorA,
        academyId,
        role: "instructor",
        status: "active",
        isActive: true,
      }),
      makeMembership({
        userId: instructorB,
        academyId,
        role: "instructor",
        status: "active",
        isActive: true,
      }),
    ];
    const svc = new ClassService(
      new InMemoryClassRepository([classA, classB]),
      new InMemoryMembershipRepository(memRows),
      new InMemoryAcademyRepository([academy]),
    );
    const items = await svc.list(ctx(instructorA, "instructor", academyId), {});
    expect(items.map((c) => c.name).sort()).toEqual(["Mine", "Theirs"]);
  });

  it("instructor can getById another instructor active class", async () => {
    const academyId = randomUUID();
    const managerId = randomUUID();
    const instructorA = randomUUID();
    const instructorB = randomUUID();
    const academy = makeAcademy({ id: academyId, ownerId: managerId });
    const classB = makeClass({
      academyId,
      instructorId: instructorB,
      isActive: true,
    });
    const memRows: MembershipRow[] = [
      makeMembership({
        userId: managerId,
        academyId,
        role: "manager",
        status: "active",
        isActive: true,
      }),
      makeMembership({
        userId: instructorA,
        academyId,
        role: "instructor",
        status: "active",
        isActive: true,
      }),
      makeMembership({
        userId: instructorB,
        academyId,
        role: "instructor",
        status: "active",
        isActive: true,
      }),
    ];
    const svc = new ClassService(
      new InMemoryClassRepository([classB]),
      new InMemoryMembershipRepository(memRows),
      new InMemoryAcademyRepository([academy]),
    );
    const row = await svc.getById(
      ctx(instructorA, "instructor", academyId),
      classB.id,
    );
    expect(row.id).toBe(classB.id);
  });

  it("instructor cannot getById another instructor inactive class", async () => {
    const academyId = randomUUID();
    const managerId = randomUUID();
    const instructorA = randomUUID();
    const instructorB = randomUUID();
    const academy = makeAcademy({ id: academyId, ownerId: managerId });
    const classB = makeClass({
      academyId,
      instructorId: instructorB,
      isActive: false,
    });
    const memRows: MembershipRow[] = [
      makeMembership({
        userId: managerId,
        academyId,
        role: "manager",
        status: "active",
        isActive: true,
      }),
      makeMembership({
        userId: instructorA,
        academyId,
        role: "instructor",
        status: "active",
        isActive: true,
      }),
      makeMembership({
        userId: instructorB,
        academyId,
        role: "instructor",
        status: "active",
        isActive: true,
      }),
    ];
    const svc = new ClassService(
      new InMemoryClassRepository([classB]),
      new InMemoryMembershipRepository(memRows),
      new InMemoryAcademyRepository([academy]),
    );
    await expect(
      svc.getById(ctx(instructorA, "instructor", academyId), classB.id),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("instructor cannot update another instructor class", async () => {
    const academyId = randomUUID();
    const managerId = randomUUID();
    const instructorA = randomUUID();
    const instructorB = randomUUID();
    const academy = makeAcademy({ id: academyId, ownerId: managerId });
    const classB = makeClass({
      academyId,
      instructorId: instructorB,
      isActive: true,
    });
    const memRows: MembershipRow[] = [
      makeMembership({
        userId: managerId,
        academyId,
        role: "manager",
        status: "active",
        isActive: true,
      }),
      makeMembership({
        userId: instructorA,
        academyId,
        role: "instructor",
        status: "active",
        isActive: true,
      }),
      makeMembership({
        userId: instructorB,
        academyId,
        role: "instructor",
        status: "active",
        isActive: true,
      }),
    ];
    const svc = new ClassService(
      new InMemoryClassRepository([classB]),
      new InMemoryMembershipRepository(memRows),
      new InMemoryAcademyRepository([academy]),
    );
    await expect(
      svc.update(ctx(instructorA, "instructor", academyId), classB.id, {
        name: "Hacked",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
