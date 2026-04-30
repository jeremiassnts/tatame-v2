import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeClass,
  makeCheckin,
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

// 2026-03-18 is a Wednesday (dayOfWeek = 3)
// Monday of that week = 2026-03-16
const FIXED_NOW = "2026-03-18T12:00:00.000Z";
const SESSION_DATE = "2026-03-18";
const WEEK_REFERENCE = "2026-03-16";

function buildService(opts: {
  academyId: string;
  userId: string;
  plan?: ReturnType<typeof makeSubscriptionPlan>;
  sub?: ReturnType<typeof makeStudentSubscription>;
  payments?: ReturnType<typeof makePayment>[];
  classRow?: ReturnType<typeof makeClass>;
  checkins?: CheckinRow[];
  membershipOverrides?: Partial<ReturnType<typeof makeMembership>>;
}) {
  const academyId = opts.academyId;
  const userId = opts.userId;

  const plan = opts.plan ?? makeSubscriptionPlan({ academyId });
  const planRepo = new InMemorySubscriptionPlanRepository([plan]);

  const sub =
    opts.sub ??
    makeStudentSubscription({
      userId,
      planId: plan.id,
      status: "active",
      startsAt: "2026-01-01",
      expiresAt: "2027-01-01",
    });
  const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, [sub]);

  const payRepo = new InMemoryPaymentRepository(
    opts.payments ?? [
      makePayment({
        subscriptionId: sub.id,
        userId,
        academyId,
        referenceMonth: "2026-03-01",
      }),
    ],
  );

  const classRow =
    opts.classRow ??
    makeClass({
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
      ...opts.membershipOverrides,
    }),
  ]);

  const svc = new CheckinService(
    memRepo,
    new InMemoryClassRepository([classRow]),
    subRepo,
    payRepo,
    new InMemoryCheckinRepository(opts.checkins ?? []),
  );

  return { svc, classRow, plan, sub };
}

describe("CheckinService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FIXED_NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Happy path ────────────────────────────────────────────────

  it("checkIn succeeds for student with active subscription and capacity", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const { svc, classRow } = buildService({ academyId, userId });

    const { checkin, warnings } = await svc.checkIn({
      userId,
      academyId,
      academyRole: "student",
      classId: classRow.id,
      sessionDate: SESSION_DATE,
    });

    expect(checkin.userId).toBe(userId);
    expect(checkin.classId).toBe(classRow.id);
    expect(checkin.date).toBe(SESSION_DATE);
    expect(checkin.weekReference).toBe(WEEK_REFERENCE);
    expect(warnings.paymentOverdue).toBeUndefined();
    expect(warnings.subscriptionGrace).toBeUndefined();
  });

  it("checkIn succeeds with unlimited capacity (null)", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const { svc, classRow } = buildService({
      academyId,
      userId,
      classRow: makeClass({
        academyId,
        dayOfWeek: 3,
        startTime: "18:00:00",
        endTime: "19:00:00",
        capacity: null,
        isActive: true,
      }),
    });

    const { checkin } = await svc.checkIn({
      userId,
      academyId,
      academyRole: "student",
      classId: classRow.id,
      sessionDate: SESSION_DATE,
    });

    expect(checkin.userId).toBe(userId);
  });

  it("checkIn succeeds with unlimited weekly limit (null)", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const plan = makeSubscriptionPlan({
      academyId,
      weeklyCheckinLimit: null,
    });
    const sub = makeStudentSubscription({
      userId,
      planId: plan.id,
      status: "active",
      startsAt: "2026-01-01",
      expiresAt: "2027-01-01",
    });

    // 5 existing checkins this week — should still succeed with null limit
    const existingCheckins: CheckinRow[] = Array.from({ length: 5 }, (_, i) =>
      makeCheckin({
        userId,
        weekReference: WEEK_REFERENCE,
        classId: randomUUID(),
        date: `2026-03-${16 + i}`,
      }),
    );

    const { svc, classRow } = buildService({
      academyId,
      userId,
      plan,
      sub,
      checkins: existingCheckins,
    });

    const { checkin } = await svc.checkIn({
      userId,
      academyId,
      academyRole: "student",
      classId: classRow.id,
      sessionDate: SESSION_DATE,
    });

    expect(checkin.userId).toBe(userId);
  });

  // ─── Capacity ──────────────────────────────────────────────────

  it("rejects check-in when class is full (capacity reached)", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const classRow = makeClass({
      academyId,
      dayOfWeek: 3,
      startTime: "18:00:00",
      endTime: "19:00:00",
      capacity: 2,
      isActive: true,
    });

    // 2 existing check-ins for this class on the same date (capacity = 2)
    const existingCheckins: CheckinRow[] = [
      makeCheckin({
        classId: classRow.id,
        userId: randomUUID(),
        date: SESSION_DATE,
        weekReference: WEEK_REFERENCE,
      }),
      makeCheckin({
        classId: classRow.id,
        userId: randomUUID(),
        date: SESSION_DATE,
        weekReference: WEEK_REFERENCE,
      }),
    ];

    const { svc } = buildService({
      academyId,
      userId,
      classRow,
      checkins: existingCheckins,
    });

    await expect(
      svc.checkIn({
        userId,
        academyId,
        academyRole: "student",
        classId: classRow.id,
        sessionDate: SESSION_DATE,
      }),
    ).rejects.toMatchObject({ statusCode: 409, message: "Class is full" });
  });

  // ─── Weekly limit ──────────────────────────────────────────────

  it("rejects check-in when weekly limit is reached", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const plan = makeSubscriptionPlan({
      academyId,
      weeklyCheckinLimit: 3,
    });
    const sub = makeStudentSubscription({
      userId,
      planId: plan.id,
      status: "active",
      startsAt: "2026-01-01",
      expiresAt: "2027-01-01",
    });

    // 3 existing check-ins this week (limit = 3)
    const existingCheckins: CheckinRow[] = Array.from({ length: 3 }, (_, i) =>
      makeCheckin({
        userId,
        classId: randomUUID(),
        date: `2026-03-${16 + i}`,
        weekReference: WEEK_REFERENCE,
      }),
    );

    const { svc, classRow } = buildService({
      academyId,
      userId,
      plan,
      sub,
      checkins: existingCheckins,
    });

    await expect(
      svc.checkIn({
        userId,
        academyId,
        academyRole: "student",
        classId: classRow.id,
        sessionDate: SESSION_DATE,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Weekly check-in limit reached",
    });
  });

  // ─── Duplicate check-in ────────────────────────────────────────

  it("rejects duplicate check-in for same class on same date", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const classRow = makeClass({
      academyId,
      dayOfWeek: 3,
      startTime: "18:00:00",
      endTime: "19:00:00",
      capacity: 10,
      isActive: true,
    });

    const existingCheckins: CheckinRow[] = [
      makeCheckin({
        classId: classRow.id,
        userId,
        date: SESSION_DATE,
        weekReference: WEEK_REFERENCE,
      }),
    ];

    const { svc } = buildService({
      academyId,
      userId,
      classRow,
      checkins: existingCheckins,
    });

    await expect(
      svc.checkIn({
        userId,
        academyId,
        academyRole: "student",
        classId: classRow.id,
        sessionDate: SESSION_DATE,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  // ─── Subscription & grace period ──────────────────────────────

  it("rejects check-in when no subscription exists", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const plan = makeSubscriptionPlan({ academyId });
    const planRepo = new InMemorySubscriptionPlanRepository([plan]);
    const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, []);

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
      new InMemoryPaymentRepository([]),
      new InMemoryCheckinRepository([]),
    );

    await expect(
      svc.checkIn({
        userId,
        academyId,
        academyRole: "student",
        classId: classRow.id,
        sessionDate: SESSION_DATE,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "No subscription for this academy",
    });
  });

  it("rejects check-in when subscription has not started yet", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const plan = makeSubscriptionPlan({ academyId });
    const sub = makeStudentSubscription({
      userId,
      planId: plan.id,
      status: "active",
      startsAt: "2026-04-01", // starts in the future
      expiresAt: "2027-04-01",
    });

    const { svc, classRow } = buildService({
      academyId,
      userId,
      plan,
      sub,
    });

    await expect(
      svc.checkIn({
        userId,
        academyId,
        academyRole: "student",
        classId: classRow.id,
        sessionDate: SESSION_DATE,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Subscription has not started yet",
    });
  });

  it("allows check-in within 3-day grace period after subscription expiry", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const plan = makeSubscriptionPlan({ academyId });
    const sub = makeStudentSubscription({
      userId,
      planId: plan.id,
      status: "active",
      startsAt: "2026-01-01",
      expiresAt: "2026-03-17", // expired yesterday (today = 2026-03-18)
    });

    const { svc, classRow } = buildService({
      academyId,
      userId,
      plan,
      sub,
    });

    const { checkin, warnings } = await svc.checkIn({
      userId,
      academyId,
      academyRole: "student",
      classId: classRow.id,
      sessionDate: SESSION_DATE,
    });

    expect(checkin.userId).toBe(userId);
    expect(warnings.subscriptionGrace).toBe(true);
  });

  it("allows check-in on last day of grace period (exactly 3 days after expiry)", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const plan = makeSubscriptionPlan({ academyId });
    const sub = makeStudentSubscription({
      userId,
      planId: plan.id,
      status: "active",
      startsAt: "2026-01-01",
      expiresAt: "2026-03-15", // grace ends on 2026-03-18 (today)
    });

    const { svc, classRow } = buildService({
      academyId,
      userId,
      plan,
      sub,
    });

    const { warnings } = await svc.checkIn({
      userId,
      academyId,
      academyRole: "student",
      classId: classRow.id,
      sessionDate: SESSION_DATE,
    });

    expect(warnings.subscriptionGrace).toBe(true);
  });

  it("rejects check-in after grace period has ended (day 4 past expiry)", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const plan = makeSubscriptionPlan({ academyId });
    const sub = makeStudentSubscription({
      userId,
      planId: plan.id,
      status: "active",
      startsAt: "2026-01-01",
      expiresAt: "2026-03-14", // grace ended on 2026-03-17 (yesterday)
    });

    const { svc, classRow } = buildService({
      academyId,
      userId,
      plan,
      sub,
    });

    await expect(
      svc.checkIn({
        userId,
        academyId,
        academyRole: "student",
        classId: classRow.id,
        sessionDate: SESSION_DATE,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: /grace period ended/,
    });
  });

  it("sets paymentOverdue warning when no payment for current month", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const plan = makeSubscriptionPlan({ academyId });
    const sub = makeStudentSubscription({
      userId,
      planId: plan.id,
      status: "active",
      startsAt: "2026-01-01",
      expiresAt: "2027-01-01",
    });

    // No payment for March 2026
    const { svc, classRow } = buildService({
      academyId,
      userId,
      plan,
      sub,
      payments: [],
    });

    const { checkin, warnings } = await svc.checkIn({
      userId,
      academyId,
      academyRole: "student",
      classId: classRow.id,
      sessionDate: SESSION_DATE,
    });

    expect(checkin.userId).toBe(userId);
    expect(warnings.paymentOverdue).toBe(true);
  });

  it("no paymentOverdue warning when payment exists for current month", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const plan = makeSubscriptionPlan({ academyId });
    const sub = makeStudentSubscription({
      userId,
      planId: plan.id,
      status: "active",
      startsAt: "2026-01-01",
      expiresAt: "2027-01-01",
    });

    const { svc, classRow } = buildService({
      academyId,
      userId,
      plan,
      sub,
      payments: [
        makePayment({
          subscriptionId: sub.id,
          userId,
          academyId,
          referenceMonth: "2026-03-01",
        }),
      ],
    });

    const { warnings } = await svc.checkIn({
      userId,
      academyId,
      academyRole: "student",
      classId: classRow.id,
      sessionDate: SESSION_DATE,
    });

    expect(warnings.paymentOverdue).toBeUndefined();
  });

  it("skips cancelled subscriptions and uses active one", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const plan = makeSubscriptionPlan({ academyId });
    const planRepo = new InMemorySubscriptionPlanRepository([plan]);

    const cancelledSub = makeStudentSubscription({
      userId,
      planId: plan.id,
      status: "cancelled",
      startsAt: "2026-01-01",
      expiresAt: "2027-01-01",
    });
    const activeSub = makeStudentSubscription({
      userId,
      planId: plan.id,
      status: "active",
      startsAt: "2026-01-01",
      expiresAt: "2027-01-01",
    });
    const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, [
      cancelledSub,
      activeSub,
    ]);

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
      new InMemoryPaymentRepository([
        makePayment({
          subscriptionId: activeSub.id,
          userId,
          academyId,
          referenceMonth: "2026-03-01",
        }),
      ]),
      new InMemoryCheckinRepository([]),
    );

    const { checkin } = await svc.checkIn({
      userId,
      academyId,
      academyRole: "student",
      classId: classRow.id,
      sessionDate: SESSION_DATE,
    });

    expect(checkin.userId).toBe(userId);
  });

  // ─── Role checks ──────────────────────────────────────────────

  it("rejects check-in for non-student role (manager)", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const { svc, classRow } = buildService({ academyId, userId });

    await expect(
      svc.checkIn({
        userId,
        academyId,
        academyRole: "manager",
        classId: classRow.id,
        sessionDate: SESSION_DATE,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Only students can check in",
    });
  });

  it("rejects check-in for non-student role (instructor)", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const { svc, classRow } = buildService({ academyId, userId });

    await expect(
      svc.checkIn({
        userId,
        academyId,
        academyRole: "instructor",
        classId: classRow.id,
        sessionDate: SESSION_DATE,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Only students can check in",
    });
  });

  // ─── Membership checks ────────────────────────────────────────

  it("rejects check-in when no active membership", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const { svc, classRow } = buildService({
      academyId,
      userId,
      membershipOverrides: { status: "pending", isActive: false },
    });

    await expect(
      svc.checkIn({
        userId,
        academyId,
        academyRole: "student",
        classId: classRow.id,
        sessionDate: SESSION_DATE,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "No active academy membership",
    });
  });

  // ─── Class validation ─────────────────────────────────────────

  it("rejects check-in for inactive class", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const { svc, classRow } = buildService({
      academyId,
      userId,
      classRow: makeClass({
        academyId,
        dayOfWeek: 3,
        startTime: "18:00:00",
        endTime: "19:00:00",
        capacity: 10,
        isActive: false,
      }),
    });

    await expect(
      svc.checkIn({
        userId,
        academyId,
        academyRole: "student",
        classId: classRow.id,
        sessionDate: SESSION_DATE,
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Class not found",
    });
  });

  it("rejects check-in for non-existent class", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const { svc } = buildService({ academyId, userId });

    await expect(
      svc.checkIn({
        userId,
        academyId,
        academyRole: "student",
        classId: randomUUID(),
        sessionDate: SESSION_DATE,
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Class not found",
    });
  });

  it("rejects check-in when sessionDate weekday does not match class dayOfWeek", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const { svc, classRow } = buildService({
      academyId,
      userId,
      classRow: makeClass({
        academyId,
        dayOfWeek: 1, // Monday, but SESSION_DATE is Wednesday
        startTime: "18:00:00",
        endTime: "19:00:00",
        capacity: 10,
        isActive: true,
      }),
    });

    await expect(
      svc.checkIn({
        userId,
        academyId,
        academyRole: "student",
        classId: classRow.id,
        sessionDate: SESSION_DATE,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Session date does not match this class weekday",
    });
  });

  // ─── Check-in window ──────────────────────────────────────────

  it("rejects check-in outside the check-in window (too early)", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const { svc, classRow } = buildService({
      academyId,
      userId,
      classRow: makeClass({
        academyId,
        dayOfWeek: 3,
        startTime: "18:00:00",
        endTime: "19:00:00",
        capacity: 10,
        isActive: true,
      }),
    });

    // Window opens at 06:00, set time to 05:59
    vi.setSystemTime(new Date("2026-03-18T05:59:00.000Z"));

    await expect(
      svc.checkIn({
        userId,
        academyId,
        academyRole: "student",
        classId: classRow.id,
        sessionDate: SESSION_DATE,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: /Check-in is only allowed/,
    });
  });

  it("rejects check-in outside the check-in window (after class ended)", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const { svc, classRow } = buildService({
      academyId,
      userId,
      classRow: makeClass({
        academyId,
        dayOfWeek: 3,
        startTime: "18:00:00",
        endTime: "19:00:00",
        capacity: 10,
        isActive: true,
      }),
    });

    // After class ended (18:00-19:00 BRT = 21:00-22:00 UTC, so 22:00:01 UTC is after)
    vi.setSystemTime(new Date("2026-03-18T22:00:01.000Z"));

    await expect(
      svc.checkIn({
        userId,
        academyId,
        academyRole: "student",
        classId: classRow.id,
        sessionDate: SESSION_DATE,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: /Check-in is only allowed/,
    });
  });

  it("allows check-in exactly at window open (12h before start)", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const { svc, classRow } = buildService({
      academyId,
      userId,
      classRow: makeClass({
        academyId,
        dayOfWeek: 3,
        startTime: "18:00:00",
        endTime: "19:00:00",
        capacity: 10,
        isActive: true,
      }),
    });

    // 12h before 18:00 BRT = 12h before 21:00 UTC = 09:00 UTC
    vi.setSystemTime(new Date("2026-03-18T09:00:00.000Z"));

    const { checkin } = await svc.checkIn({
      userId,
      academyId,
      academyRole: "student",
      classId: classRow.id,
      sessionDate: SESSION_DATE,
    });

    expect(checkin.userId).toBe(userId);
  });

  // ─── Cross-midnight class ─────────────────────────────────────

  it("allows check-in for cross-midnight class within window", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const classRow = makeClass({
      academyId,
      dayOfWeek: 3, // Wednesday
      startTime: "23:00:00",
      endTime: "01:00:00", // crosses midnight BRT = 02:00-04:00 UTC
      capacity: 10,
      isActive: true,
    });
    const { svc } = buildService({ academyId, userId, classRow });

    // 12h before 23:00 BRT = 12h before 02:00 UTC (next day) = 14:00 UTC Wednesday
    vi.setSystemTime(new Date("2026-03-18T14:00:00.000Z"));

    const { checkin } = await svc.checkIn({
      userId,
      academyId,
      academyRole: "student",
      classId: classRow.id,
      sessionDate: SESSION_DATE,
    });

    expect(checkin.userId).toBe(userId);
  });

  it("allows check-in for cross-midnight class just before end (after midnight)", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const classRow = makeClass({
      academyId,
      dayOfWeek: 3,
      startTime: "23:00:00",
      endTime: "01:00:00",
      capacity: 10,
      isActive: true,
    });
    const { svc } = buildService({ academyId, userId, classRow });

    // 00:30 on Thursday — still before end (01:00)
    vi.setSystemTime(new Date("2026-03-19T00:30:00.000Z"));

    const { checkin } = await svc.checkIn({
      userId,
      academyId,
      academyRole: "student",
      classId: classRow.id,
      sessionDate: SESSION_DATE,
    });

    expect(checkin.userId).toBe(userId);
  });

  // ─── Expired subscription auto-update ─────────────────────────

  it("auto-updates subscription status from active to expired when expiresAt has passed", async () => {
    const academyId = randomUUID();
    const userId = randomUUID();
    const plan = makeSubscriptionPlan({ academyId });
    const sub = makeStudentSubscription({
      userId,
      planId: plan.id,
      status: "active", // still marked as active
      startsAt: "2026-01-01",
      expiresAt: "2026-03-16", // expired 2 days ago — within grace
    });

    const { svc, classRow } = buildService({
      academyId,
      userId,
      plan,
      sub,
    });

    const { warnings } = await svc.checkIn({
      userId,
      academyId,
      academyRole: "student",
      classId: classRow.id,
      sessionDate: SESSION_DATE,
    });

    // Should succeed (within grace) and mark as grace
    expect(warnings.subscriptionGrace).toBe(true);
    // The subscription status should have been updated to expired
    expect(sub.status).toBe("expired");
  });
});
