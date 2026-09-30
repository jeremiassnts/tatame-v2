import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeClass,
  makeCheckin,
  makeDependent,
  makeMembership,
  makePayment,
  makeStudentSubscription,
  makeSubscriptionPlan,
} from "../../testing/factories/index.js";
import { InMemoryClassRepository } from "../class/class.repository.in-memory.js";
import { InMemoryDependentRepository } from "../dependent/dependent.repository.in-memory.js";
import type { DependentRow } from "../dependent/dependent.repository.js";
import { InMemoryCheckinRepository } from "./checkin.repository.in-memory.js";
import { InMemoryMembershipRepository } from "../membership/membership.repository.in-memory.js";
import { InMemoryPaymentRepository } from "../payment/payment.repository.in-memory.js";
import {
  InMemoryStudentSubscriptionRepository,
  InMemorySubscriptionPlanRepository,
} from "../subscription/subscription.repository.in-memory.js";
import type { CheckinRow } from "./checkin.repository.js";
import { CheckinService } from "./checkin.service.js";

// Only `withCheckinLock` is stubbed. The rest of the module comes through for
// real, because `CheckinLockBusyError` is compared with `instanceof` in the
// service — a stand-in class would silently never match.
vi.mock("../../lib/lock.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/lock.js")>()),
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
  extraPlans?: ReturnType<typeof makeSubscriptionPlan>[];
  sub?: ReturnType<typeof makeStudentSubscription>;
  extraSubs?: ReturnType<typeof makeStudentSubscription>[];
  payments?: ReturnType<typeof makePayment>[];
  classRow?: ReturnType<typeof makeClass>;
  checkins?: CheckinRow[];
  membershipOverrides?: Partial<ReturnType<typeof makeMembership>>;
  dependents?: DependentRow[];
  engagementService?: ConstructorParameters<typeof CheckinService>[7];
}) {
  const academyId = opts.academyId;
  const userId = opts.userId;

  const plan = opts.plan ?? makeSubscriptionPlan({ academyId });
  const planRepo = new InMemorySubscriptionPlanRepository([
    plan,
    ...(opts.extraPlans ?? []),
  ]);

  const sub =
    opts.sub ??
    makeStudentSubscription({
      userId,
      planId: plan.id,
      status: "active",
      startsAt: "2026-01-01",
      expiresAt: "2027-01-01",
    });
  const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, [sub, ...(opts.extraSubs ?? [])]);

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

  const checkinRepo = new InMemoryCheckinRepository(opts.checkins ?? [], [
    classRow,
  ]);

  const svc = new CheckinService(
    memRepo,
    new InMemoryClassRepository([classRow]),
    subRepo,
    payRepo,
    checkinRepo,
    new InMemoryDependentRepository(opts.dependents ?? []),
    undefined,
    opts.engagementService,
  );

  return { svc, classRow, plan, sub, checkinRepo };
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
    ).rejects.toMatchObject({ statusCode: 409, message: "Aula lotada — não há mais vagas para esta sessão" });
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
      message: "Limite semanal de check-ins atingido",
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
      new InMemoryDependentRepository([]),
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
      message: "Você não possui um plano ativo nesta academia",
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
      new InMemoryDependentRepository([]),
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
      message: "Apenas alunos podem fazer check-in",
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
      message: "Apenas alunos podem fazer check-in",
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
      message: "Você não possui matrícula ativa nesta academia",
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
      message: "Aula não encontrada",
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
      message: "Aula não encontrada",
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
      message: /check-in abre 12 horas/,
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
      message: /check-in abre 12 horas/,
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

  // ─── Dependent check-in ───────────────────────────────────────

  describe("dependent check-in", () => {
    it("guardian can check in for their dependent", async () => {
      const academyId = randomUUID();
      const guardianId = randomUUID();
      const dependentId = randomUUID();
      const plan = makeSubscriptionPlan({ academyId });
      const depSub = makeStudentSubscription({
        userId: guardianId,
        planId: plan.id,
        dependentId,
        status: "active",
        startsAt: "2026-01-01",
        expiresAt: "2027-01-01",
      });
      const { svc, classRow } = buildService({
        academyId,
        userId: guardianId,
        plan,
        extraSubs: [depSub],
        dependents: [makeDependent({ id: dependentId, guardianId, academyId })],
        payments: [
          makePayment({ subscriptionId: depSub.id, userId: guardianId, academyId, referenceMonth: "2026-03-01" }),
        ],
        membershipOverrides: { role: "guardian" },
      });

      const { checkin, warnings } = await svc.checkIn({
        userId: guardianId,
        academyId,
        academyRole: "guardian",
        classId: classRow.id,
        sessionDate: SESSION_DATE,
        dependentId,
      });

      expect(checkin.userId).toBe(guardianId);
      expect(checkin.dependentId).toBe(dependentId);
      expect(checkin.classId).toBe(classRow.id);
      expect(checkin.date).toBe(SESSION_DATE);
      expect(warnings.paymentOverdue).toBeUndefined();
      expect(warnings.subscriptionGrace).toBeUndefined();
    });

    it("guardian cannot check in without dependentId", async () => {
      const academyId = randomUUID();
      const guardianId = randomUUID();
      const { svc, classRow } = buildService({
        academyId,
        userId: guardianId,
        membershipOverrides: { role: "guardian" },
      });

      await expect(
        svc.checkIn({
          userId: guardianId,
          academyId,
          academyRole: "guardian",
          classId: classRow.id,
          sessionDate: SESSION_DATE,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Responsável deve informar o dependente para check-in",
      });
    });

    /**
     * `dependentId` comes from the request body. These four cases are the ones
     * that made it worth checking ownership in the service instead of in the
     * route: each one is a caller reaching past their own household.
     */
    describe("only the guardian of record can check in a dependent", () => {
      /** Two unrelated households in the same academy. */
      function buildTwoHouseholds() {
        const academyId = randomUUID();
        const guardianId = randomUUID();
        const strangerId = randomUUID();
        const dependentId = randomUUID();

        const plan = makeSubscriptionPlan({ academyId });
        const depSub = makeStudentSubscription({
          userId: guardianId,
          planId: plan.id,
          dependentId,
          status: "active",
          startsAt: "2026-01-01",
          expiresAt: "2027-01-01",
        });
        const dependent = makeDependent({ id: dependentId, guardianId, academyId });

        return { academyId, guardianId, strangerId, dependentId, plan, depSub, dependent };
      }

      it("refuses a guardian who is not this dependent's guardian", async () => {
        const h = buildTwoHouseholds();
        // The stranger is a legitimate, active member of the same academy —
        // only the guardian relationship is missing.
        const { svc, classRow } = buildService({
          academyId: h.academyId,
          userId: h.strangerId,
          plan: h.plan,
          extraSubs: [h.depSub],
          dependents: [h.dependent],
          membershipOverrides: { role: "guardian" },
        });

        await expect(
          svc.checkIn({
            userId: h.strangerId,
            academyId: h.academyId,
            academyRole: "guardian",
            classId: classRow.id,
            sessionDate: SESSION_DATE,
            dependentId: h.dependentId,
          }),
        ).rejects.toMatchObject({
          statusCode: 403,
          message: "Você não é responsável por este dependente",
        });
      });

      it("refuses a student who passes someone else's dependent", async () => {
        const h = buildTwoHouseholds();
        const { svc, classRow } = buildService({
          academyId: h.academyId,
          userId: h.strangerId,
          plan: h.plan,
          extraSubs: [h.depSub],
          dependents: [h.dependent],
        });

        await expect(
          svc.checkIn({
            userId: h.strangerId,
            academyId: h.academyId,
            academyRole: "student",
            classId: classRow.id,
            sessionDate: SESSION_DATE,
            dependentId: h.dependentId,
          }),
        ).rejects.toMatchObject({
          statusCode: 403,
          message: "Você não é responsável por este dependente",
        });
      });

      it("writes nothing when the dependent is not the caller's", async () => {
        const h = buildTwoHouseholds();
        const { svc, classRow, checkinRepo } = buildService({
          academyId: h.academyId,
          userId: h.strangerId,
          plan: h.plan,
          extraSubs: [h.depSub],
          dependents: [h.dependent],
          membershipOverrides: { role: "guardian" },
        });

        await expect(
          svc.checkIn({
            userId: h.strangerId,
            academyId: h.academyId,
            academyRole: "guardian",
            classId: classRow.id,
            sessionDate: SESSION_DATE,
            dependentId: h.dependentId,
          }),
        ).rejects.toMatchObject({ statusCode: 403 });

        // The point of the refusal: the dependent's allowance is untouched, so
        // the real guardian's own check-in is not later refused as a duplicate.
        await expect(
          checkinRepo.countByDependentAndWeek(h.dependentId, WEEK_REFERENCE),
        ).resolves.toBe(0);
      });

      it("refuses an unknown dependent id with the same answer as someone else's", async () => {
        const h = buildTwoHouseholds();
        const { svc, classRow } = buildService({
          academyId: h.academyId,
          userId: h.guardianId,
          plan: h.plan,
          extraSubs: [h.depSub],
          dependents: [h.dependent],
          membershipOverrides: { role: "guardian" },
        });

        await expect(
          svc.checkIn({
            userId: h.guardianId,
            academyId: h.academyId,
            academyRole: "guardian",
            classId: classRow.id,
            sessionDate: SESSION_DATE,
            dependentId: randomUUID(),
          }),
        ).rejects.toMatchObject({
          statusCode: 403,
          message: "Você não é responsável por este dependente",
        });
      });

      it("refuses a dependent who belongs to another academy", async () => {
        const h = buildTwoHouseholds();
        const otherAcademyId = randomUUID();
        // Same guardian, but the dependent was enrolled at a different academy.
        const { svc, classRow } = buildService({
          academyId: h.academyId,
          userId: h.guardianId,
          plan: h.plan,
          extraSubs: [h.depSub],
          dependents: [
            makeDependent({
              id: h.dependentId,
              guardianId: h.guardianId,
              academyId: otherAcademyId,
            }),
          ],
          membershipOverrides: { role: "guardian" },
        });

        await expect(
          svc.checkIn({
            userId: h.guardianId,
            academyId: h.academyId,
            academyRole: "guardian",
            classId: classRow.id,
            sessionDate: SESSION_DATE,
            dependentId: h.dependentId,
          }),
        ).rejects.toMatchObject({
          statusCode: 403,
          message: "Este dependente não pertence a esta academia",
        });
      });
    });

    it("student can check in for themselves (existing behavior preserved)", async () => {
      const academyId = randomUUID();
      const userId = randomUUID();
      const { svc, classRow } = buildService({ academyId, userId });

      const { checkin } = await svc.checkIn({
        userId,
        academyId,
        academyRole: "student",
        classId: classRow.id,
        sessionDate: SESSION_DATE,
      });

      expect(checkin.userId).toBe(userId);
      expect(checkin.dependentId).toBeNull();
    });

    it("student can check in for their dependent", async () => {
      const academyId = randomUUID();
      const userId = randomUUID();
      const dependentId = randomUUID();
      const plan = makeSubscriptionPlan({ academyId });
      const depSub = makeStudentSubscription({
        userId,
        planId: plan.id,
        dependentId,
        status: "active",
        startsAt: "2026-01-01",
        expiresAt: "2027-01-01",
      });
      const { svc, classRow } = buildService({
        academyId,
        userId,
        plan,
        extraSubs: [depSub],
        dependents: [makeDependent({ id: dependentId, guardianId: userId, academyId })],
      });

      const { checkin } = await svc.checkIn({
        userId,
        academyId,
        academyRole: "student",
        classId: classRow.id,
        sessionDate: SESSION_DATE,
        dependentId,
      });

      expect(checkin.userId).toBe(userId);
      expect(checkin.dependentId).toBe(dependentId);
    });

    it("weekly limit is enforced per dependent, not shared with guardian", async () => {
      const academyId = randomUUID();
      const guardianId = randomUUID();
      const dependentId = randomUUID();

      const plan = makeSubscriptionPlan({ academyId, weeklyCheckinLimit: 2 });
      const sub = makeStudentSubscription({
        userId: guardianId,
        planId: plan.id,
        status: "active",
        startsAt: "2026-01-01",
        expiresAt: "2027-01-01",
      });
      const depSub = makeStudentSubscription({
        userId: guardianId,
        planId: plan.id,
        dependentId,
        status: "active",
        startsAt: "2026-01-01",
        expiresAt: "2027-01-01",
      });

      // Guardian has 0 checkins this week (limit not reached for guardian)
      // Dependent already has 2 checkins this week (limit reached for dependent)
      const dependentCheckins: CheckinRow[] = Array.from({ length: 2 }, (_, i) =>
        makeCheckin({
          userId: randomUUID(), // another guardian who did the earlier check-ins
          dependentId,
          classId: randomUUID(),
          date: `2026-03-${16 + i}`,
          weekReference: WEEK_REFERENCE,
        }),
      );

      const { svc, classRow } = buildService({
        academyId,
        userId: guardianId,
        plan,
        sub,
        extraSubs: [depSub],
        dependents: [makeDependent({ id: dependentId, guardianId, academyId })],
        checkins: dependentCheckins,
        membershipOverrides: { role: "guardian" },
      });

      await expect(
        svc.checkIn({
          userId: guardianId,
          academyId,
          academyRole: "guardian",
          classId: classRow.id,
          sessionDate: SESSION_DATE,
          dependentId,
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Limite semanal de check-ins atingido",
      });
    });

    /**
     * TAT-181. A dependent's row carries the guardian's `user_id`, so anything
     * keyed on `user_id` alone used to fold the child's training into the
     * parent's.
     */
    /**
     * The other half of the same invariant: resolving the *account holder's*
     * own plan must not pick up a dependent's row. A dependent's subscription
     * carries the guardian's `user_id` and is created later, so it sorted
     * first and won.
     */
    describe("the guardian's own plan is resolved from their own subscription", () => {
      it("refuses a guardian who has no plan of their own but a dependent who does", async () => {
        const academyId = randomUUID();
        const guardianId = randomUUID();
        const dependentId = randomUUID();
        const kidsPlan = makeSubscriptionPlan({ academyId, weeklyCheckinLimit: 2 });

        // The household's only subscription belongs to the dependent.
        const { svc, classRow } = buildService({
          academyId,
          userId: guardianId,
          plan: kidsPlan,
          sub: makeStudentSubscription({
            userId: guardianId,
            planId: kidsPlan.id,
            dependentId,
            status: "active",
            startsAt: "2026-01-01",
            expiresAt: "2027-01-01",
          }),
          dependents: [makeDependent({ id: dependentId, guardianId, academyId })],
        });

        await expect(
          svc.checkIn({
            userId: guardianId,
            academyId,
            academyRole: "student",
            classId: classRow.id,
            sessionDate: SESSION_DATE,
          }),
        ).rejects.toMatchObject({
          statusCode: 403,
          message: "Você não possui um plano ativo nesta academia",
        });
      });

      it("measures the guardian against their own weekly limit, not the dependent's", async () => {
        const academyId = randomUUID();
        const guardianId = randomUUID();
        const dependentId = randomUUID();

        const adultPlan = makeSubscriptionPlan({ academyId, weeklyCheckinLimit: 5 });
        const kidsPlan = makeSubscriptionPlan({ academyId, weeklyCheckinLimit: 1 });

        // Explicit timestamps: the dependent's row has to be the newer one, or
        // the fixture does not reproduce what the bug depended on.
        const ownSub = makeStudentSubscription({
          userId: guardianId,
          planId: adultPlan.id,
          status: "active",
          startsAt: "2026-01-01",
          expiresAt: "2027-01-01",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        });
        const depSub = makeStudentSubscription({
          userId: guardianId,
          planId: kidsPlan.id,
          dependentId,
          status: "active",
          startsAt: "2026-01-01",
          expiresAt: "2027-01-01",
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
        });

        // Two own sessions already taken: over the kids limit of 1, well under
        // the adult limit of 5.
        const { svc, classRow } = buildService({
          academyId,
          userId: guardianId,
          plan: adultPlan,
          extraPlans: [kidsPlan],
          sub: ownSub,
          extraSubs: [depSub],
          dependents: [makeDependent({ id: dependentId, guardianId, academyId })],
          payments: [
            makePayment({
              subscriptionId: ownSub.id,
              userId: guardianId,
              academyId,
              referenceMonth: "2026-03-01",
            }),
          ],
          checkins: [0, 1].map((i) =>
            makeCheckin({
              userId: guardianId,
              dependentId: null,
              classId: randomUUID(),
              date: `2026-03-${16 + i}`,
              weekReference: WEEK_REFERENCE,
            }),
          ),
        });

        const { checkin } = await svc.checkIn({
          userId: guardianId,
          academyId,
          academyRole: "student",
          classId: classRow.id,
          sessionDate: SESSION_DATE,
        });

        expect(checkin.dependentId).toBeNull();
      });
    });

    describe("the guardian's own counters ignore their dependents", () => {
      /** Guardian and dependent sharing one plan, capped at 2/week by default. */
      function buildHousehold(weeklyCheckinLimit: number | null = 2) {
        const academyId = randomUUID();
        const guardianId = randomUUID();
        const dependentId = randomUUID();

        const plan = makeSubscriptionPlan({ academyId, weeklyCheckinLimit });
        const sub = makeStudentSubscription({
          userId: guardianId,
          planId: plan.id,
          status: "active",
          startsAt: "2026-01-01",
          expiresAt: "2027-01-01",
        });
        const depSub = makeStudentSubscription({
          userId: guardianId,
          planId: plan.id,
          dependentId,
          status: "active",
          startsAt: "2026-01-01",
          expiresAt: "2027-01-01",
        });

        const dependent = makeDependent({ id: dependentId, guardianId, academyId });

        return { academyId, guardianId, dependentId, dependent, plan, sub, depSub };
      }

      /** The dependent's two sessions, both carrying the guardian's id. */
      function dependentCheckins(
        guardianId: string,
        dependentId: string,
        classId: string,
      ): CheckinRow[] {
        return [0, 1].map((i) =>
          makeCheckin({
            userId: guardianId,
            dependentId,
            classId,
            date: `2026-03-${16 + i}`,
            weekReference: WEEK_REFERENCE,
          }),
        );
      }

      it("a dependent's check-ins do not consume the guardian's weekly limit", async () => {
        const h = buildHousehold();
        const classRow = makeClass({
          academyId: h.academyId,
          dayOfWeek: 3,
          startTime: "18:00:00",
          endTime: "19:00:00",
          capacity: 10,
          isActive: true,
        });

        const { svc } = buildService({
          academyId: h.academyId,
          userId: h.guardianId,
          plan: h.plan,
          sub: h.sub,
          extraSubs: [h.depSub],
          classRow,
          checkins: dependentCheckins(h.guardianId, h.dependentId, classRow.id),
          payments: [
            makePayment({
              subscriptionId: h.sub.id,
              userId: h.guardianId,
              academyId: h.academyId,
              referenceMonth: "2026-03-01",
            }),
          ],
        });

        const { checkin } = await svc.checkIn({
          userId: h.guardianId,
          academyId: h.academyId,
          academyRole: "student",
          classId: classRow.id,
          sessionDate: SESSION_DATE,
        });

        expect(checkin.dependentId).toBeNull();
      });

      it("getWeeklyCount counts only the account holder's own check-ins", async () => {
        const h = buildHousehold();
        const classRow = makeClass({
          academyId: h.academyId,
          dayOfWeek: 3,
          startTime: "18:00:00",
          endTime: "19:00:00",
          capacity: 10,
          isActive: true,
        });
        const { svc } = buildService({
          academyId: h.academyId,
          userId: h.guardianId,
          plan: h.plan,
          sub: h.sub,
          extraSubs: [h.depSub],
          classRow,
          checkins: dependentCheckins(h.guardianId, h.dependentId, classRow.id),
        });

        await expect(svc.getWeeklyCount(h.guardianId)).resolves.toMatchObject({
          count: 0,
        });
        await expect(
          svc.getWeeklyCountForDependent(h.dependentId),
        ).resolves.toMatchObject({ count: 2 });
      });

      it("each history holds only its own side of the household", async () => {
        const h = buildHousehold();
        const classRow = makeClass({
          academyId: h.academyId,
          dayOfWeek: 3,
          startTime: "18:00:00",
          endTime: "19:00:00",
          capacity: 10,
          isActive: true,
        });
        const ownCheckin = makeCheckin({
          userId: h.guardianId,
          dependentId: null,
          classId: classRow.id,
          date: "2026-03-17",
          weekReference: WEEK_REFERENCE,
        });
        const { svc } = buildService({
          academyId: h.academyId,
          userId: h.guardianId,
          plan: h.plan,
          sub: h.sub,
          extraSubs: [h.depSub],
          classRow,
          checkins: [
            ownCheckin,
            ...dependentCheckins(h.guardianId, h.dependentId, classRow.id),
          ],
        });

        const mine = await svc.getHistory(h.guardianId, { limit: 4 });
        expect(mine.items).toHaveLength(1);
        expect(mine.items[0]?.count).toBe(1);
        expect(mine.items[0]?.checkins[0]?.id).toBe(ownCheckin.id);

        const theirs = await svc.getHistoryForDependent(h.dependentId, {
          limit: 4,
        });
        expect(theirs.items[0]?.count).toBe(2);
        expect(
          theirs.items[0]?.checkins.map((c) => c.id),
        ).not.toContain(ownCheckin.id);
      });

      it("a dependent's check-in does not advance the guardian's milestones", async () => {
        const h = buildHousehold(null);
        const checkMilestone = vi.fn().mockResolvedValue(undefined);
        const { svc, classRow } = buildService({
          academyId: h.academyId,
          userId: h.guardianId,
          plan: h.plan,
          sub: h.sub,
          extraSubs: [h.depSub],
          dependents: [h.dependent],
          engagementService: {
            checkMilestone,
          } as unknown as ConstructorParameters<typeof CheckinService>[7],
        });

        await svc.checkIn({
          userId: h.guardianId,
          academyId: h.academyId,
          academyRole: "student",
          classId: classRow.id,
          sessionDate: SESSION_DATE,
          dependentId: h.dependentId,
        });
        expect(checkMilestone).not.toHaveBeenCalled();

        await svc.checkIn({
          userId: h.guardianId,
          academyId: h.academyId,
          academyRole: "student",
          classId: classRow.id,
          sessionDate: SESSION_DATE,
        });
        expect(checkMilestone).toHaveBeenCalledWith(h.guardianId);
      });
    });

    it("duplicate dependent check-in returns 409", async () => {
      const academyId = randomUUID();
      const guardianId = randomUUID();
      const dependentId = randomUUID();
      const classRow = makeClass({
        academyId,
        dayOfWeek: 3,
        startTime: "18:00:00",
        endTime: "19:00:00",
        capacity: 10,
        isActive: true,
      });

      const plan = makeSubscriptionPlan({ academyId });
      const depSub = makeStudentSubscription({
        userId: guardianId,
        planId: plan.id,
        dependentId,
        status: "active",
        startsAt: "2026-01-01",
        expiresAt: "2027-01-01",
      });

      // Guardian already checked this dependent into this class today
      const existingCheckins: CheckinRow[] = [
        makeCheckin({
          classId: classRow.id,
          userId: guardianId,
          dependentId,
          date: SESSION_DATE,
          weekReference: WEEK_REFERENCE,
        }),
      ];

      const { svc } = buildService({
        academyId,
        userId: guardianId,
        plan,
        classRow,
        extraSubs: [depSub],
        dependents: [makeDependent({ id: dependentId, guardianId, academyId })],
        checkins: existingCheckins,
        membershipOverrides: { role: "guardian" },
      });

      await expect(
        svc.checkIn({
          userId: guardianId,
          academyId,
          academyRole: "guardian",
          classId: classRow.id,
          sessionDate: SESSION_DATE,
          dependentId,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
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
