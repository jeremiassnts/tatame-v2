import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  makeAcademy,
  makeStudentSubscription,
  makeSubscriptionPlan,
} from "../../testing/factories/index.js";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import {
  InMemoryStudentSubscriptionRepository,
  InMemorySubscriptionPlanRepository,
} from "./subscription.repository.in-memory.js";
import {
  addCalendarMonths,
  isExpiredByDate,
  SubscriptionService,
  utcTodayDateString,
} from "./subscription.service.js";

describe("subscription helpers", () => {
  it("addCalendarMonths advances calendar month", () => {
    expect(addCalendarMonths("2026-03-01", 1)).toBe("2026-04-01");
    expect(addCalendarMonths("2026-03-01", 12)).toBe("2027-03-01");
  });

  it("isExpiredByDate compares ISO dates", () => {
    expect(isExpiredByDate("2026-01-01", "2026-01-02")).toBe(true);
    expect(isExpiredByDate("2026-06-01", "2026-01-02")).toBe(false);
  });
});

describe("SubscriptionService", () => {
  it("getPlan throws 404 when plan in other academy", async () => {
    const academy = makeAcademy();
    const plan = makeSubscriptionPlan({ academyId: randomUUID() });
    const planRepo = new InMemorySubscriptionPlanRepository([plan]);
    const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, []);
    const svc = new SubscriptionService(
      planRepo,
      subRepo,
      new InMemoryAcademyRepository([academy]),
    );
    await expect(svc.getPlan(academy.id, plan.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("selectPlan creates active subscription with computed expiry", async () => {
    const userId = randomUUID();
    const academy = makeAcademy();
    const plan = makeSubscriptionPlan({
      academyId: academy.id,
      recurrenceMonths: 2,
      isActive: true,
    });
    const planRepo = new InMemorySubscriptionPlanRepository([plan]);
    const subRows: import("./subscription.repository.js").StudentSubscriptionRow[] =
      [];
    const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, subRows);
    const svc = new SubscriptionService(
      planRepo,
      subRepo,
      new InMemoryAcademyRepository([academy]),
    );

    const { subscription, plan: p } = await svc.selectPlan(
      userId,
      academy.id,
      plan.id,
    );
    expect(p.id).toBe(plan.id);
    expect(subscription.status).toBe("active");
    const starts = utcTodayDateString();
    expect(subscription.startsAt).toBe(starts);
    expect(subscription.expiresAt).toBe(addCalendarMonths(starts, 2));
    expect(subRows).toHaveLength(1);
  });

  it("getMySubscription marks stale active rows as expired", async () => {
    const userId = randomUUID();
    const academy = makeAcademy();
    const plan = makeSubscriptionPlan({ academyId: academy.id });
    const planRepo = new InMemorySubscriptionPlanRepository([plan]);
    const past = "2020-01-01";
    const sub = makeStudentSubscription({
      userId,
      planId: plan.id,
      status: "active",
      startsAt: "2019-01-01",
      expiresAt: past,
    });
    const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, [sub]);
    const svc = new SubscriptionService(
      planRepo,
      subRepo,
      new InMemoryAcademyRepository([academy]),
    );

    const me = await svc.getMySubscription(userId, academy.id);
    expect(me.subscription?.status).toBe("expired");
    expect(me.subscription?.effectiveStatus).toBe("expired");
  });

  // ─── Deactivated plan does not affect existing subscriptions ──

  it("selectPlan rejects inactive plan (409)", async () => {
    const userId = randomUUID();
    const academy = makeAcademy();
    const plan = makeSubscriptionPlan({
      academyId: academy.id,
      isActive: false,
    });
    const planRepo = new InMemorySubscriptionPlanRepository([plan]);
    const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, []);
    const svc = new SubscriptionService(
      planRepo,
      subRepo,
      new InMemoryAcademyRepository([academy]),
    );

    await expect(
      svc.selectPlan(userId, academy.id, plan.id),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "This subscription plan is no longer available",
    });
  });

  it("deactivating a plan does not cancel existing active subscriptions", async () => {
    const userId = randomUUID();
    const managerId = randomUUID();
    const academy = makeAcademy({ ownerId: managerId });
    const plan = makeSubscriptionPlan({
      academyId: academy.id,
      isActive: true,
      recurrenceMonths: 1,
    });
    const planRepo = new InMemorySubscriptionPlanRepository([plan]);

    // Student has an active subscription on this plan
    const sub = makeStudentSubscription({
      userId,
      planId: plan.id,
      status: "active",
      startsAt: "2026-01-01",
      expiresAt: "2027-01-01",
    });
    const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, [sub]);
    const svc = new SubscriptionService(
      planRepo,
      subRepo,
      new InMemoryAcademyRepository([academy]),
    );

    // Manager deactivates the plan
    await svc.updatePlan(managerId, academy.id, plan.id, { isActive: false });

    // Existing subscription is still active and accessible
    const me = await svc.getMySubscription(userId, academy.id);
    expect(me.subscription).not.toBeNull();
    expect(me.subscription?.status).toBe("active");
    expect(me.subscription?.effectiveStatus).toBe("active");
    expect(me.plan?.id).toBe(plan.id);
  });

  it("deactivated plan still shows in manager's list with includeInactive", async () => {
    const managerId = randomUUID();
    const academy = makeAcademy({ ownerId: managerId });
    const plan = makeSubscriptionPlan({
      academyId: academy.id,
      isActive: true,
    });
    const planRepo = new InMemorySubscriptionPlanRepository([plan]);
    const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, []);
    const svc = new SubscriptionService(
      planRepo,
      subRepo,
      new InMemoryAcademyRepository([academy]),
    );

    // Deactivate the plan
    await svc.updatePlan(managerId, academy.id, plan.id, { isActive: false });

    // Manager can still see it with includeInactive
    const allPlans = await svc.listPlans(academy.id, {
      includeInactive: true,
      requesterRole: "manager",
    });
    expect(allPlans).toHaveLength(1);
    expect(allPlans[0]!.isActive).toBe(false);

    // Student cannot see inactive plans
    const studentPlans = await svc.listPlans(academy.id, {
      includeInactive: false,
      requesterRole: "student",
    });
    expect(studentPlans).toHaveLength(0);
  });
});
