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

  it("listPending returns pending memberships for manager", async () => {
    const ownerId = randomUUID();
    const academy = makeAcademy({ ownerId });
    const pending = makeMembership({
      academyId: academy.id,
      status: "pending",
      isActive: false,
      role: "student",
    });
    const active = makeMembership({
      academyId: academy.id,
      status: "active",
      isActive: true,
      role: "student",
    });
    const { svc } = makeSvc([academy], [pending, active]);
    const list = await svc.listPending(academy.id, ownerId);
    expect(list).toHaveLength(1);
    expect(list[0]!.status).toBe("pending");
  });

  it("reject changes pending membership to rejected", async () => {
    const ownerId = randomUUID();
    const academy = makeAcademy({ ownerId });
    const pending = makeMembership({
      academyId: academy.id,
      status: "pending",
      isActive: false,
      role: "student",
    });
    const { svc } = makeSvc([academy], [pending]);
    const updated = await svc.reject(pending.id, ownerId);
    expect(updated.status).toBe("rejected");
  });

  it("reject returns 404 when membership not found", async () => {
    const ownerId = randomUUID();
    const academy = makeAcademy({ ownerId });
    const { svc } = makeSvc([academy], []);
    await expect(svc.reject(randomUUID(), ownerId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("reject returns 409 when membership is not pending", async () => {
    const ownerId = randomUUID();
    const academy = makeAcademy({ ownerId });
    const active = makeMembership({
      academyId: academy.id,
      status: "active",
      isActive: true,
      role: "student",
    });
    const { svc } = makeSvc([academy], [active]);
    await expect(svc.reject(active.id, ownerId)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("block blocks an active membership", async () => {
    const ownerId = randomUUID();
    const academy = makeAcademy({ ownerId });
    const active = makeMembership({
      academyId: academy.id,
      status: "active",
      isActive: true,
      role: "student",
    });
    const { svc } = makeSvc([academy], [active]);
    const updated = await svc.block(active.id, ownerId);
    expect(updated.status).toBe("blocked");
  });

  it("block blocks a pending membership", async () => {
    const ownerId = randomUUID();
    const academy = makeAcademy({ ownerId });
    const pending = makeMembership({
      academyId: academy.id,
      status: "pending",
      isActive: false,
      role: "student",
    });
    const { svc } = makeSvc([academy], [pending]);
    const updated = await svc.block(pending.id, ownerId);
    expect(updated.status).toBe("blocked");
  });

  it("block returns 409 when membership is already blocked", async () => {
    const ownerId = randomUUID();
    const academy = makeAcademy({ ownerId });
    const blocked = makeMembership({
      academyId: academy.id,
      status: "blocked",
      isActive: false,
      role: "student",
    });
    const { svc } = makeSvc([academy], [blocked]);
    await expect(svc.block(blocked.id, ownerId)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("unblock deletes a blocked membership", async () => {
    const ownerId = randomUUID();
    const academy = makeAcademy({ ownerId });
    const blocked = makeMembership({
      academyId: academy.id,
      status: "blocked",
      isActive: false,
      role: "student",
    });
    const memRows = [blocked];
    const { svc } = makeSvc([academy], memRows);
    await svc.unblock(blocked.id, ownerId);
    expect(memRows).toHaveLength(0);
  });

  it("unblock deletes a rejected membership", async () => {
    const ownerId = randomUUID();
    const academy = makeAcademy({ ownerId });
    const rejected = makeMembership({
      academyId: academy.id,
      status: "rejected",
      isActive: false,
      role: "student",
    });
    const memRows = [rejected];
    const { svc } = makeSvc([academy], memRows);
    await svc.unblock(rejected.id, ownerId);
    expect(memRows).toHaveLength(0);
  });

  it("unblock returns 409 when membership is active", async () => {
    const ownerId = randomUUID();
    const academy = makeAcademy({ ownerId });
    const active = makeMembership({
      academyId: academy.id,
      status: "active",
      isActive: true,
      role: "student",
    });
    const { svc } = makeSvc([academy], [active]);
    await expect(svc.unblock(active.id, ownerId)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("leave allows non-owner to leave", async () => {
    const ownerId = randomUUID();
    const userId = randomUUID();
    const academy = makeAcademy({ ownerId });
    const active = makeMembership({
      academyId: academy.id,
      userId,
      status: "active",
      isActive: true,
      role: "student",
    });
    const { svc } = makeSvc([academy], [active]);
    const updated = await svc.leave(userId);
    // `leave` returns either the updated row or `{ id, deleted: true }` when the
    // membership was merely pending. Asserting the branch is what makes
    // `leftAt` reachable, and it was the test's unstated assumption anyway.
    if ("deleted" in updated) throw new Error("expected the active-membership branch");
    expect(updated.leftAt).toBeTruthy();
  });

  it("leave returns 404 when no active membership", async () => {
    const userId = randomUUID();
    const { svc } = makeSvc([], []);
    await expect(svc.leave(userId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("approve returns 404 when membership not found", async () => {
    const ownerId = randomUUID();
    const academy = makeAcademy({ ownerId });
    const { svc } = makeSvc([academy], []);
    await expect(svc.approve(randomUUID(), ownerId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("approve returns 409 when membership is not pending", async () => {
    const ownerId = randomUUID();
    const academy = makeAcademy({ ownerId });
    const active = makeMembership({
      academyId: academy.id,
      status: "active",
      isActive: true,
      role: "student",
    });
    const { svc } = makeSvc([academy], [active]);
    await expect(svc.approve(active.id, ownerId)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("approve returns 409 when target user has active membership elsewhere", async () => {
    const ownerId = randomUUID();
    const academy = makeAcademy({ ownerId });
    const otherAcademy = makeAcademy();
    const studentId = randomUUID();
    const pending = makeMembership({
      academyId: academy.id,
      userId: studentId,
      status: "pending",
      isActive: false,
      role: "student",
    });
    const activeElsewhere = makeMembership({
      academyId: otherAcademy.id,
      userId: studentId,
      status: "active",
      isActive: true,
      role: "student",
    });
    const { svc } = makeSvc([academy, otherAcademy], [pending, activeElsewhere]);
    await expect(svc.approve(pending.id, ownerId)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("request returns 403 when user is blocked", async () => {
    const userId = randomUUID();
    const academy = makeAcademy();
    const blocked = makeMembership({
      academyId: academy.id,
      userId,
      status: "blocked",
      isActive: false,
      role: "student",
    });
    const { svc } = makeSvc([academy], [blocked]);
    await expect(svc.request(userId, "student", academy.id)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
