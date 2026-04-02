import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  makeAcademy,
  makeMembership,
} from "../../testing/factories/index.js";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import type { AcademyRow } from "../academy/academy.repository.js";
import { InMemoryMembershipRepository } from "./membership.repository.in-memory.js";
import type { MembershipRow } from "./membership.repository.js";
import { MembershipService } from "./membership.service.js";

function makeSvc(acadRows: AcademyRow[], memRows: MembershipRow[]) {
  const acadRepo = new InMemoryAcademyRepository(acadRows);
  const memRepo = new InMemoryMembershipRepository(memRows);
  return { svc: new MembershipService(memRepo, acadRepo), memRepo };
}

describe("MembershipService", () => {
  it("request creates pending membership", async () => {
    const userId = randomUUID();
    const academy = makeAcademy();
    const memRows: MembershipRow[] = [];
    const { svc } = makeSvc([academy], memRows);

    const m = await svc.request(userId, "student", academy.id);
    expect(m.status).toBe("pending");
    expect(m.isActive).toBe(false);
    expect(memRows).toHaveLength(1);
  });

  it("request returns 404 when academy missing", async () => {
    const { svc } = makeSvc([], []);
    await expect(
      svc.request(randomUUID(), "student", randomUUID()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("request returns 409 when user already has active membership", async () => {
    const userId = randomUUID();
    const a1 = makeAcademy();
    const a2 = makeAcademy();
    const active = makeMembership({
      userId,
      academyId: a1.id,
      status: "active",
      isActive: true,
      role: "student",
    });
    const { svc } = makeSvc([a1, a2], [active]);
    await expect(svc.request(userId, "student", a2.id)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("approve activates pending and rejects other pendings for user", async () => {
    const ownerId = randomUUID();
    const academy = makeAcademy({ ownerId });
    const studentId = randomUUID();
    const pending1 = makeMembership({
      academyId: academy.id,
      userId: studentId,
      status: "pending",
      isActive: false,
      role: "student",
    });
    const pending2 = makeMembership({
      academyId: randomUUID(),
      userId: studentId,
      status: "pending",
      isActive: false,
      role: "student",
    });
    const memRows = [pending1, pending2];
    const { svc } = makeSvc([academy], memRows);

    const updated = await svc.approve(pending1.id, ownerId);
    expect(updated.status).toBe("active");
    expect(updated.isActive).toBe(true);
    const other = memRows.find((m) => m.id === pending2.id);
    expect(other?.status).toBe("rejected");
  });

  it("leave returns 403 for academy owner", async () => {
    const ownerId = randomUUID();
    const academy = makeAcademy({ ownerId });
    const active = makeMembership({
      academyId: academy.id,
      userId: ownerId,
      status: "active",
      isActive: true,
      role: "manager",
    });
    const { svc } = makeSvc([academy], [active]);
    await expect(svc.leave(ownerId)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("getMemberDetail allows manager owner for any membership status in academy", async () => {
    const ownerId = randomUUID();
    const academy = makeAcademy({ ownerId });
    const pendingMem = makeMembership({
      academyId: academy.id,
      status: "pending",
      isActive: false,
      role: "student",
    });
    const { svc } = makeSvc([academy], [pendingMem]);
    const detail = await svc.getMemberDetail(pendingMem.id, ownerId, "manager");
    expect(detail.id).toBe(pendingMem.id);
  });

  it("getMemberDetail allows instructor in same academy for active target membership", async () => {
    const academy = makeAcademy();
    const instructorId = randomUUID();
    const studentMem = makeMembership({
      academyId: academy.id,
      status: "active",
      isActive: true,
      role: "student",
    });
    const instructorMem = makeMembership({
      academyId: academy.id,
      userId: instructorId,
      status: "active",
      isActive: true,
      role: "instructor",
    });
    const { svc } = makeSvc([academy], [studentMem, instructorMem]);
    const detail = await svc.getMemberDetail(
      studentMem.id,
      instructorId,
      "instructor",
    );
    expect(detail.userId).toBe(studentMem.userId);
  });

  it("getMemberDetail returns 403 for instructor when target membership is not active", async () => {
    const academy = makeAcademy();
    const instructorId = randomUUID();
    const pendingMem = makeMembership({
      academyId: academy.id,
      status: "pending",
      isActive: false,
      role: "student",
    });
    const instructorMem = makeMembership({
      academyId: academy.id,
      userId: instructorId,
      status: "active",
      isActive: true,
      role: "instructor",
    });
    const { svc } = makeSvc([academy], [pendingMem, instructorMem]);
    await expect(
      svc.getMemberDetail(pendingMem.id, instructorId, "instructor"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("getMemberDetail returns 403 for instructor not in target academy", async () => {
    const a1 = makeAcademy();
    const a2 = makeAcademy();
    const instructorId = randomUUID();
    const studentInA2 = makeMembership({
      academyId: a2.id,
      status: "active",
      isActive: true,
      role: "student",
    });
    const instructorInA1 = makeMembership({
      academyId: a1.id,
      userId: instructorId,
      status: "active",
      isActive: true,
      role: "instructor",
    });
    const { svc } = makeSvc([a1, a2], [studentInA2, instructorInA1]);
    await expect(
      svc.getMemberDetail(studentInA2.id, instructorId, "instructor"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
