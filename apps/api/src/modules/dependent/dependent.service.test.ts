import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { makeMembership } from "../../testing/factories/index.js";
import { InMemoryGraduationRepository } from "../graduation/graduation.repository.in-memory.js";
import { InMemoryMembershipRepository } from "../membership/membership.repository.in-memory.js";
import { InMemoryStudentSubscriptionRepository } from "../subscription/subscription.repository.in-memory.js";
import { InMemorySubscriptionPlanRepository } from "../subscription/subscription.repository.in-memory.js";
import { InMemoryDependentRepository } from "./dependent.repository.in-memory.js";
import { DependentService } from "./dependent.service.js";

function buildService(opts: {
  memberships?: ReturnType<typeof makeMembership>[];
} = {}) {
  const depRepo = new InMemoryDependentRepository();
  const memRepo = new InMemoryMembershipRepository(opts.memberships ?? []);
  const gradRepo = new InMemoryGraduationRepository();
  const planRepo = new InMemorySubscriptionPlanRepository();
  const subRepo = new InMemoryStudentSubscriptionRepository(planRepo);

  const svc = new DependentService(depRepo, memRepo, gradRepo, subRepo);

  return { svc, depRepo, memRepo, gradRepo };
}

describe("DependentService", () => {
  // ─── create ────────────────────────────────────────────────────

  it("guardian with active membership can create a dependent", async () => {
    const userId = randomUUID();
    const academyId = randomUUID();

    const { svc } = buildService({
      memberships: [
        makeMembership({ userId, academyId, role: "guardian", status: "active", isActive: true }),
      ],
    });

    const dep = await svc.create({
      userId,
      role: "guardian",
      academyId,
      name: "Lucas Silva",
      birthDate: "2015-06-01",
      belt: "white",
      stripes: 0,
    });

    expect(dep.guardianId).toBe(userId);
    expect(dep.academyId).toBe(academyId);
    expect(dep.name).toBe("Lucas Silva");
    expect(dep.birthDate).toBe("2015-06-01");
    expect(dep.deletedAt).toBeNull();
  });

  it("student with active membership can create a dependent", async () => {
    const userId = randomUUID();
    const academyId = randomUUID();

    const { svc } = buildService({
      memberships: [
        makeMembership({ userId, academyId, role: "student", status: "active", isActive: true }),
      ],
    });

    const dep = await svc.create({
      userId,
      role: "student",
      academyId,
      name: "Maria Santos",
      birthDate: "2018-03-15",
      belt: "white",
      stripes: 2,
    });

    expect(dep.guardianId).toBe(userId);
    expect(dep.name).toBe("Maria Santos");
  });

  it("instructor cannot create a dependent (403)", async () => {
    const userId = randomUUID();
    const academyId = randomUUID();

    const { svc } = buildService({
      memberships: [
        makeMembership({ userId, academyId, role: "instructor", status: "active", isActive: true }),
      ],
    });

    await expect(
      svc.create({
        userId,
        role: "instructor",
        academyId,
        name: "Filho do Instrutor",
        birthDate: "2016-01-01",
        belt: "white",
        stripes: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("manager cannot create a dependent (403)", async () => {
    const userId = randomUUID();
    const academyId = randomUUID();

    const { svc } = buildService({
      memberships: [
        makeMembership({ userId, academyId, role: "manager", status: "active", isActive: true }),
      ],
    });

    await expect(
      svc.create({
        userId,
        role: "manager",
        academyId,
        name: "Filho do Gestor",
        birthDate: "2016-01-01",
        belt: "white",
        stripes: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("creation fails when membership is not active", async () => {
    const userId = randomUUID();
    const academyId = randomUUID();

    const { svc } = buildService({
      memberships: [
        makeMembership({ userId, academyId, role: "guardian", status: "pending", isActive: false }),
      ],
    });

    await expect(
      svc.create({
        userId,
        role: "guardian",
        academyId,
        name: "Filho Pendente",
        birthDate: "2016-01-01",
        belt: "white",
        stripes: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("creation with invalid belt/stripes combination throws 400", async () => {
    const userId = randomUUID();
    const academyId = randomUUID();

    const { svc } = buildService({
      memberships: [
        makeMembership({ userId, academyId, role: "guardian", status: "active", isActive: true }),
      ],
    });

    // white belt only allows 0–4 stripes; 5 is invalid
    await expect(
      svc.create({
        userId,
        role: "guardian",
        academyId,
        name: "Filho Inválido",
        birthDate: "2016-01-01",
        belt: "white",
        stripes: 5,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  // ─── listMine ──────────────────────────────────────────────────

  it("guardian can list their own dependents", async () => {
    const userId = randomUUID();
    const academyId = randomUUID();

    const { svc, depRepo } = buildService({
      memberships: [
        makeMembership({ userId, academyId, role: "guardian", status: "active", isActive: true }),
      ],
    });

    await depRepo.insert({ guardianId: userId, academyId, name: "A", birthDate: "2015-01-01" });
    await depRepo.insert({ guardianId: userId, academyId, name: "B", birthDate: "2016-01-01" });

    const list = await svc.listMine(userId);

    expect(list).toHaveLength(2);
    expect(list.every((d) => d.guardianId === userId)).toBe(true);
  });

  it("guardian does not see another guardian's dependents", async () => {
    const userId = randomUUID();
    const otherId = randomUUID();
    const academyId = randomUUID();

    const { svc, depRepo } = buildService();

    await depRepo.insert({ guardianId: otherId, academyId, name: "Filho do Outro", birthDate: "2015-01-01" });

    const list = await svc.listMine(userId);

    expect(list).toHaveLength(0);
  });

  // ─── getById ───────────────────────────────────────────────────

  it("guardian cannot see another guardian's dependent (404)", async () => {
    const userId = randomUUID();
    const otherId = randomUUID();
    const academyId = randomUUID();

    const { svc, depRepo } = buildService();

    const dep = await depRepo.insert({ guardianId: otherId, academyId, name: "Filho do Outro", birthDate: "2015-01-01" });

    await expect(
      svc.getById(userId, "guardian", dep.id),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("manager can see any dependent in their academy", async () => {
    const managerId = randomUUID();
    const guardianId = randomUUID();
    const academyId = randomUUID();

    const { svc, depRepo } = buildService();

    const dep = await depRepo.insert({ guardianId, academyId, name: "Filho", birthDate: "2015-01-01" });

    const found = await svc.getById(managerId, "manager", dep.id, academyId);

    expect(found.id).toBe(dep.id);
  });

  it("manager cannot see a dependent from a different academy (404)", async () => {
    const managerId = randomUUID();
    const guardianId = randomUUID();
    const academyId = randomUUID();
    const otherAcademyId = randomUUID();

    const { svc, depRepo } = buildService();

    const dep = await depRepo.insert({ guardianId, academyId, name: "Filho", birthDate: "2015-01-01" });

    await expect(
      svc.getById(managerId, "manager", dep.id, otherAcademyId),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("getById throws 404 for nonexistent dependent", async () => {
    const { svc } = buildService();

    await expect(
      svc.getById(randomUUID(), "guardian", randomUUID()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  // ─── update ────────────────────────────────────────────────────

  it("guardian can update their own dependent", async () => {
    const userId = randomUUID();
    const academyId = randomUUID();

    const { svc, depRepo } = buildService();

    const dep = await depRepo.insert({ guardianId: userId, academyId, name: "Filho Original", birthDate: "2015-01-01" });

    const updated = await svc.update(userId, "guardian", dep.id, { name: "Filho Atualizado" });

    expect(updated?.name).toBe("Filho Atualizado");
  });

  it("guardian cannot update another guardian's dependent (404)", async () => {
    const userId = randomUUID();
    const otherId = randomUUID();
    const academyId = randomUUID();

    const { svc, depRepo } = buildService();

    const dep = await depRepo.insert({ guardianId: otherId, academyId, name: "Filho do Outro", birthDate: "2015-01-01" });

    await expect(
      svc.update(userId, "guardian", dep.id, { name: "Hackeado" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  // ─── delete ────────────────────────────────────────────────────

  it("guardian can soft-delete their own dependent", async () => {
    const userId = randomUUID();
    const academyId = randomUUID();

    const { svc, depRepo } = buildService();

    const dep = await depRepo.insert({ guardianId: userId, academyId, name: "Filho", birthDate: "2015-01-01" });

    await svc.delete(userId, "guardian", dep.id);

    // Should no longer be findable (soft-deleted)
    const found = await depRepo.findById(dep.id);
    expect(found).toBeUndefined();
  });

  it("guardian cannot delete another guardian's dependent (404)", async () => {
    const userId = randomUUID();
    const otherId = randomUUID();
    const academyId = randomUUID();

    const { svc, depRepo } = buildService();

    const dep = await depRepo.insert({ guardianId: otherId, academyId, name: "Filho do Outro", birthDate: "2015-01-01" });

    await expect(
      svc.delete(userId, "guardian", dep.id),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  // ─── listByAcademy ─────────────────────────────────────────────

  it("manager can list all dependents in their academy", async () => {
    const managerId = randomUUID();
    const academyId = randomUUID();
    const otherAcademyId = randomUUID();

    const { svc, depRepo } = buildService();

    await depRepo.insert({ guardianId: randomUUID(), academyId, name: "Filho A", birthDate: "2015-01-01" });
    await depRepo.insert({ guardianId: randomUUID(), academyId, name: "Filho B", birthDate: "2016-01-01" });
    await depRepo.insert({ guardianId: randomUUID(), academyId: otherAcademyId, name: "Filho C", birthDate: "2017-01-01" });

    const list = await svc.listByAcademy(managerId, "manager", academyId);

    expect(list).toHaveLength(2);
    expect(list.every((d) => d.academyId === academyId)).toBe(true);
  });

  it("non-manager cannot list academy dependents (403)", async () => {
    const { svc } = buildService();

    await expect(
      svc.listByAcademy(randomUUID(), "guardian", randomUUID()),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  // ─── assertGuardianOwnership ───────────────────────────────────

  it("assertGuardianOwnership returns dependent when ownership is valid", async () => {
    const userId = randomUUID();
    const academyId = randomUUID();

    const { svc, depRepo } = buildService();

    const dep = await depRepo.insert({ guardianId: userId, academyId, name: "Filho", birthDate: "2015-01-01" });

    const result = await svc.assertGuardianOwnership(userId, dep.id);

    expect(result.id).toBe(dep.id);
    expect(result.guardianId).toBe(userId);
  });

  it("assertGuardianOwnership throws 403 for wrong guardian", async () => {
    const userId = randomUUID();
    const wrongUserId = randomUUID();
    const academyId = randomUUID();

    const { svc, depRepo } = buildService();

    const dep = await depRepo.insert({ guardianId: userId, academyId, name: "Filho", birthDate: "2015-01-01" });

    await expect(
      svc.assertGuardianOwnership(wrongUserId, dep.id),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("assertGuardianOwnership throws 403 for nonexistent dependent", async () => {
    const { svc } = buildService();

    await expect(
      svc.assertGuardianOwnership(randomUUID(), randomUUID()),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
