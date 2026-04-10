import { describe, expect, it } from "vitest";
import { AdminService } from "./admin.service.js";
import type { IAdminRepository, AcademyDetailRow } from "./admin.repository.js";

function makeFakeRepo(overrides: Partial<IAdminRepository> = {}): IAdminRepository {
  return {
    countActiveSubscribers: async () => 10,
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
      activeSubscribers: 10,
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
});
