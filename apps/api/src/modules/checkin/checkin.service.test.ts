import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeClass,
  makeMembership,
  makePayment,
  makeStudentSubscription,
  makeSubscriptionPlan,
} from "../../testing/factories/index.js";
import { InMemoryClassRepository } from "../class/class.repository.in-memory.js";
import { InMemoryCheckinRepository } from "./checkin.repository.in-memory.js";
import { InMemoryMembershipRepository } from "../membership/membership.repository.in-memory.js";
import { InMemoryPaymentRepository } from "../payment/payment.repository.in-memory.js";
import {
  InMemoryStudentSubscriptionRepository,
  InMemorySubscriptionPlanRepository,
} from "../subscription/subscription.repository.in-memory.js";
import type { CheckinRow } from "./checkin.repository.js";
import { CheckinService } from "./checkin.service.js";

vi.mock("../../lib/lock.js", () => ({
  withCheckinLock: (
    _redis: unknown,
    _classId: unknown,
    _date: unknown,
    fn: () => Promise<unknown>,
  ) => fn(),
}));

vi.mock("../../lib/redis.js", () => ({
  requireRedisForCheckin: () => ({}),
}));

describe("CheckinService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-18T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("checkIn succeeds for student with subscription and capacity", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const plan = makeSubscriptionPlan({ academyId });
    const planRepo = new InMemorySubscriptionPlanRepository([plan]);
    const sub = makeStudentSubscription({
      userId,
      planId: plan.id,
      status: "active",
      startsAt: "2026-01-01",
      expiresAt: "2027-01-01",
    });
    const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, [sub]);
    const payRepo = new InMemoryPaymentRepository([
      makePayment({
        subscriptionId: sub.id,
        userId,
        academyId,
        referenceMonth: "2026-03-01",
      }),
    ]);
    const sessionDate = "2026-03-18";
    const classRow = makeClass({
      academyId,
      dayOfWeek: 3,
      startTime: "18:00:00",
      endTime: "19:00:00",
      capacity: 10,
      isActive: true,
    });
    const memRepo = new InMemoryMembershipRepository([
      makeMembership({
        userId,
        academyId,
        role: "student",
        status: "active",
        isActive: true,
      }),
    ]);
    const svc = new CheckinService(
      memRepo,
      new InMemoryClassRepository([classRow]),
      subRepo,
      payRepo,
      new InMemoryCheckinRepository([]),
    );

    const { checkin, warnings } = await svc.checkIn({
      userId,
      academyId,
      academyRole: "student",
      classId: classRow.id,
      sessionDate,
    });
    expect(checkin.userId).toBe(userId);
    expect(checkin.classId).toBe(classRow.id);
    expect(warnings.paymentOverdue).toBeUndefined();
  });

  it("checkIn returns 409 when duplicate", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const plan = makeSubscriptionPlan({ academyId });
    const planRepo = new InMemorySubscriptionPlanRepository([plan]);
    const sub = makeStudentSubscription({
      userId,
      planId: plan.id,
      status: "active",
      startsAt: "2026-01-01",
      expiresAt: "2027-01-01",
    });
    const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, [sub]);
    const payRepo = new InMemoryPaymentRepository([
      makePayment({
        subscriptionId: sub.id,
        userId,
        academyId,
        referenceMonth: "2026-03-01",
      }),
    ]);
    const sessionDate = "2026-03-18";
    const classRow = makeClass({
      academyId,
      dayOfWeek: 3,
      startTime: "18:00:00",
      endTime: "19:00:00",
      capacity: 10,
      isActive: true,
    });
    const checkinRows: CheckinRow[] = [
      {
        id: randomUUID(),
        classId: classRow.id,
        userId,
        date: sessionDate,
        weekReference: "2026-03-16",
        checkedInAt: new Date(),
      },
    ];
    const memRepo = new InMemoryMembershipRepository([
      makeMembership({
        userId,
        academyId,
        role: "student",
        status: "active",
        isActive: true,
      }),
    ]);
    const svc = new CheckinService(
      memRepo,
      new InMemoryClassRepository([classRow]),
      subRepo,
      payRepo,
      new InMemoryCheckinRepository(checkinRows),
    );

    await expect(
      svc.checkIn({
        userId,
        academyId,
        academyRole: "student",
        classId: classRow.id,
        sessionDate,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
