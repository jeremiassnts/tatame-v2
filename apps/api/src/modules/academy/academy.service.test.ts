import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { makeAcademy } from "../../testing/factories/index.js";
import { InMemoryMembershipRepository } from "../membership/membership.repository.in-memory.js";
import type { MembershipRow } from "../membership/membership.repository.js";
import { InMemoryAcademyRepository } from "./academy.repository.in-memory.js";
import type { AcademyRow } from "./academy.repository.js";
import { AcademyService } from "./academy.service.js";

describe("AcademyService", () => {
  it("createWithManagerMembership creates academy and manager membership", async () => {
    const ownerId = randomUUID();
    const memRows: MembershipRow[] = [];
    const memRepo = new InMemoryMembershipRepository(memRows);
    const acadRows: AcademyRow[] = [];
    const acadRepo = new InMemoryAcademyRepository(acadRows, memRepo);
    const svc = new AcademyService(acadRepo, () => memRepo);

    const created = await svc.createWithManagerMembership(ownerId, {
      name: "Nova Academia",
    });
    expect(created.ownerId).toBe(ownerId);
    expect(created.name).toBe("Nova Academia");
    expect(memRows).toHaveLength(1);
    expect(memRows[0]!.role).toBe("manager");
    expect(memRows[0]!.status).toBe("active");
    expect(memRows[0]!.isActive).toBe(true);
  });

  it("searchByName returns empty for blank query", async () => {
    const memRepo = new InMemoryMembershipRepository([]);
    const acadRepo = new InMemoryAcademyRepository([], memRepo);
    const svc = new AcademyService(acadRepo, () => memRepo);
    expect(await svc.searchByName("   ")).toEqual([]);
  });

  it("update throws 404 when academy missing", async () => {
    const memRepo = new InMemoryMembershipRepository([]);
    const acadRepo = new InMemoryAcademyRepository([], memRepo);
    const svc = new AcademyService(acadRepo, () => memRepo);
    const id = randomUUID();
    await expect(
      svc.update(id, randomUUID(), { name: "Nope" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("update throws 403 when caller is not owner", async () => {
    const memRepo = new InMemoryMembershipRepository([]);
    const acadRows = [makeAcademy({ ownerId: randomUUID() })];
    const acadRepo = new InMemoryAcademyRepository(acadRows, memRepo);
    const svc = new AcademyService(acadRepo, () => memRepo);
    await expect(
      svc.update(acadRows[0]!.id, randomUUID(), { name: "Hack" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("projects only the public fields of an academy", async () => {
    const memRepo = new InMemoryMembershipRepository([]);
    const acadRows = [
      makeAcademy({
        name: "Academia Tatame",
        logoUrl: "https://cdn.example/logo.png",
        pixKey: "dojo@example.com",
        pixKeyType: "email",
        contactEmail: "contato@example.com",
        contactPhone: "+5511999999999",
        address: "Rua Um, 100",
      }),
    ];
    const acadRepo = new InMemoryAcademyRepository(acadRows, memRepo);
    const svc = new AcademyService(acadRepo, () => memRepo);

    const row = acadRows[0]!;
    const publicView = await svc.getPublicById(row.id);

    expect(publicView).toEqual({
      id: row.id,
      name: "Academia Tatame",
      logoUrl: "https://cdn.example/logo.png",
    });
  });

  it("returns null for an academy that does not exist", async () => {
    const memRepo = new InMemoryMembershipRepository([]);
    const acadRepo = new InMemoryAcademyRepository([], memRepo);
    const svc = new AcademyService(acadRepo, () => memRepo);

    expect(await svc.getPublicById(randomUUID())).toBeNull();
  });

  it("update succeeds for owner", async () => {
    const ownerId = randomUUID();
    const memRepo = new InMemoryMembershipRepository([]);
    const acadRows = [makeAcademy({ ownerId })];
    const acadRepo = new InMemoryAcademyRepository(acadRows, memRepo);
    const svc = new AcademyService(acadRepo, () => memRepo);
    const updated = await svc.update(acadRows[0]!.id, ownerId, {
      name: "Renamed",
    });
    expect(updated.name).toBe("Renamed");
  });
});
