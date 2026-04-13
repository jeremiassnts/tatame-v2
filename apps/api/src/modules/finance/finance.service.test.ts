import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { makeAcademy } from "../../testing/factories/index.js";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import { InMemoryPaymentRepository } from "../payment/payment.repository.in-memory.js";
import {
  InMemoryStudentSubscriptionRepository,
  InMemorySubscriptionPlanRepository,
} from "../subscription/subscription.repository.in-memory.js";
import { FinanceService } from "./finance.service.js";

describe("FinanceService", () => {
  function setup(overrides: { ownerId?: string } = {}) {
    const managerId = overrides.ownerId ?? randomUUID();
    const academy = makeAcademy({ ownerId: managerId });
    const paymentRepo = new InMemoryPaymentRepository();
    const planRepo = new InMemorySubscriptionPlanRepository([]);
    const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, []);
    const academyRepo = new InMemoryAcademyRepository([academy]);
    const svc = new FinanceService(paymentRepo, subRepo, academyRepo);
    return { svc, managerId, academy };
  }

  it("getSummary returns financial summary shape (happy path)", async () => {
    const { svc, managerId, academy } = setup();
    const summary = await svc.getSummary(managerId, academy.id);

    expect(summary).toEqual({
      revenueCurrentMonth: expect.any(Number),
      revenuePreviousMonth: expect.any(Number),
      pendingPaymentsCount: expect.any(Number),
      pendingPaymentsTotal: expect.any(Number),
      activeSubscriptionsCount: expect.any(Number),
    });
    expect(summary.revenueCurrentMonth).toBe(0);
    expect(summary.revenuePreviousMonth).toBe(0);
    expect(summary.pendingPaymentsCount).toBe(0);
    expect(summary.pendingPaymentsTotal).toBe(0);
    expect(summary.activeSubscriptionsCount).toBe(0);
  });

  it("getSummary throws 404 when academy not found", async () => {
    const { svc, managerId } = setup();
    await expect(
      svc.getSummary(managerId, randomUUID()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("getSummary throws 403 when non-owner requests", async () => {
    const { svc, academy } = setup();
    const nonOwner = randomUUID();
    await expect(
      svc.getSummary(nonOwner, academy.id),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
