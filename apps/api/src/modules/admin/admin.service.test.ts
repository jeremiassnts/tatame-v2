import { describe, expect, it } from "vitest";
import { AdminService } from "./admin.service.js";
import type { IAdminRepository, AcademyDetailRow } from "./admin.repository.js";

function makeFakeRepo(overrides: Partial<IAdminRepository> = {}): IAdminRepository {
  return {
    countManagerSubscriptions: async () => ({ total: 10, pro: 7, free: 3 }),
    countTotalUsers: async () => 50,
    sumAppRevenueCents: async () => 100_000,
    sumTransferredCents: async () => 60_000,
    sumPendingTransferCents: async () => 40_000,
    getDailyCheckins: async () => [],
    listAcademies: async () => [],
    getAcademyDetail: async () => undefined,
    countStudentsByAcademy: async () => 0,
    sumAcademyRevenueCentsForMonth: async () => 0,
    sumAcademyTransferredCents: async () => 0,
    sumAcademyPendingTransferCents: async () => 0,
    listAcademyPayments: async () => ({ items: [], total: 0 }),
    markTransferred: async () => 0,
    ...overrides,
  };
}

describe("AdminService", () => {
  it("getDashboard returns aggregated KPIs", async () => {
    const svc = new AdminService(makeFakeRepo());
    const result = await svc.getDashboard();
    expect(result).toEqual({
      subscribers: { total: 10, pro: 7, free: 3 },
      totalUsers: 50,
      appRevenueCents: 100_000,
      transferredCents: 60_000,
    });
  });

  it("getFinancialSummary returns transfer totals", async () => {
    const svc = new AdminService(makeFakeRepo());
    const result = await svc.getFinancialSummary();
    expect(result).toEqual({
      transferredCents: 60_000,
      pendingTransferCents: 40_000,
    });
  });

  it("getAcademyDetail throws 404 when academy not found", async () => {
    const svc = new AdminService(makeFakeRepo());
    await expect(svc.getAcademyDetail("nonexistent")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("getAcademyDetail returns detail with KPIs", async () => {
    const academy: AcademyDetailRow = {
      id: "a1",
      name: "Test Academy",
      ownerName: "Owner",
      ownerEmail: "owner@test.com",
      ownerPhone: null,
      managerPlan: "pro",
      managerPlanStatus: "active",
    };
    const svc = new AdminService(
      makeFakeRepo({
        getAcademyDetail: async () => academy,
        countStudentsByAcademy: async () => 25,
        sumAcademyRevenueCentsForMonth: async () => 50_000,
        sumAcademyTransferredCents: async () => 30_000,
        sumAcademyPendingTransferCents: async () => 20_000,
      }),
    );
    const result = await svc.getAcademyDetail("a1");
    expect(result.academy.name).toBe("Test Academy");
    expect(result.studentCount).toBe(25);
    expect(result.pendingTransferCents).toBe(20_000);
  });

  it("confirmTransfer throws 400 for empty array", async () => {
    const svc = new AdminService(makeFakeRepo());
    await expect(svc.confirmTransfer([])).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("confirmTransfer delegates to repo", async () => {
    const svc = new AdminService(
      makeFakeRepo({ markTransferred: async (ids) => ids.length }),
    );
    const updated = await svc.confirmTransfer(["p1", "p2"]);
    expect(updated).toBe(2);
  });

  it("getCheckins delegates to repo with 7 days", async () => {
    const checkins = [
      { date: "2026-04-11", count: 5 },
      { date: "2026-04-12", count: 3 },
    ];
    const svc = new AdminService(
      makeFakeRepo({ getDailyCheckins: async (days) => checkins.slice(0, days) }),
    );
    const result = await svc.getCheckins();
    expect(result).toEqual(checkins);
  });

  it("listAcademies delegates to repo", async () => {
    const academies = [
      {
        id: "a1",
        name: "Academy 1",
        ownerName: "Owner 1",
        ownerEmail: "o1@test.com",
        ownerPhone: null,
        managerPlan: "pro" as const,
        managerPlanStatus: "active" as const,
        studentCount: 10,
        pendingTransferCents: 5000,
      },
    ];
    const svc = new AdminService(
      makeFakeRepo({ listAcademies: async () => academies }),
    );
    const result = await svc.listAcademies();
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Academy 1");
  });

  it("listAcademyPayments delegates to repo", async () => {
    const payments = {
      items: [
        {
          id: "p1",
          userName: "User 1",
          amountCents: 5000,
          method: "pix" as const,
          referenceMonth: "2026-04-01",
          paidAt: new Date(),
          transferredAt: null,
        },
      ],
      total: 1,
    };
    const svc = new AdminService(
      makeFakeRepo({ listAcademyPayments: async () => payments }),
    );
    const result = await svc.listAcademyPayments("a1", { limit: 10, offset: 0 });
    expect(result.total).toBe(1);
    expect(result.items[0]!.id).toBe("p1");
  });
});
