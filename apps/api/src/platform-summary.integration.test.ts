import {
  academies,
  academyMemberships,
  checkins,
  classes,
  managerSubscriptions,
  payments,
  pendingAsaasPayments,
  studentSubscriptions,
  subscriptionPlans,
  users,
} from "@tatame/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PostgresPlatformSummaryRepository } from "./modules/platform-summary/platform-summary.repository.postgres.js";
import { brtDayWindow } from "./modules/platform-summary/platform-summary.service.js";
import {
  makeAcademy,
  makeCheckin,
  makeClass,
  makeManagerSubscription,
  makeMembership,
  makePayment,
  makeStudentSubscription,
  makeSubscriptionPlan,
  makeUser,
} from "./testing/factories/index.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

/** 2026-09-11 BRT — mid-day, safely inside the window on both ends. */
const DAY = "2026-09-11";
const INSIDE = new Date("2026-09-11T15:00:00Z");
/** 01:00 BRT on the 11th is 04:00 UTC — inside the window, outside the UTC day. */
const EARLY_BRT = new Date("2026-09-11T04:00:00Z");
/** 22:00 BRT on the 10th is 01:00 UTC on the 11th — the *previous* BRT day. */
const LATE_PREVIOUS_BRT = new Date("2026-09-11T01:00:00Z");
/**
 * `window.end` exactly: `brtDayWindow` opens at 03:00 UTC and spans 24 hours, so
 * the BRT day ends at 03:00 UTC the next day. The bound is `lt`, so a row at
 * this instant belongs to the *next* day and must not be counted — which makes
 * this the one value that tells `lt` from `lte` apart, and both of those from
 * no upper bound at all.
 */
const WINDOW_END = new Date("2026-09-12T03:00:00Z");

describe("PostgresPlatformSummaryRepository", () => {
  let ctx: Awaited<ReturnType<typeof setupIntegrationTest>>;
  let repo: PostgresPlatformSummaryRepository;
  const window = brtDayWindow(DAY);

  beforeAll(async () => {
    ctx = await setupIntegrationTest();
    repo = new PostgresPlatformSummaryRepository(ctx.db);
  });

  beforeEach(async () => {
    await ctx.truncateAll();
  });

  afterAll(async () => {
    await ctx.dropSchema();
  });

  async function seedAcademy(overrides: Partial<{ name: string }> = {}) {
    const owner = makeUser();
    await ctx.db.insert(users).values(owner);
    const academy = makeAcademy({ ownerId: owner.id, ...overrides });
    await ctx.db.insert(academies).values(academy);
    return { owner, academy };
  }

  it("counts payments inside the BRT day, not the UTC day", async () => {
    const { owner, academy } = await seedAcademy();
    const plan = makeSubscriptionPlan({ academyId: academy.id });
    await ctx.db.insert(subscriptionPlans).values(plan);
    const sub = makeStudentSubscription({ userId: owner.id, planId: plan.id });
    await ctx.db.insert(studentSubscriptions).values(sub);

    const base = {
      subscriptionId: sub.id,
      userId: owner.id,
      academyId: academy.id,
      // The factory defaults this to a random uuid, which no `users` row has.
      confirmedBy: null,
    };
    await ctx.db.insert(payments).values([
      makePayment({ ...base, method: "pix", amountCents: 10_000, paidAt: INSIDE }),
      makePayment({ ...base, method: "pix", amountCents: 5_000, paidAt: EARLY_BRT }),
      makePayment({
        ...base,
        method: "stripe",
        amountCents: 20_000,
        paidAt: INSIDE,
      }),
      // 22:00 BRT on the 10th — must not be counted for the 11th.
      makePayment({
        ...base,
        method: "pix",
        amountCents: 99_900,
        paidAt: LATE_PREVIOUS_BRT,
      }),
    ]);

    const rows = await repo.paymentsPerAcademy(window);
    const pix = rows.find((r) => r.method === "pix");
    const card = rows.find((r) => r.method === "stripe");

    expect(pix).toMatchObject({ count: 2, amountCents: 15_000 });
    expect(card).toMatchObject({ count: 1, amountCents: 20_000 });
  });

  // This metric already broke once by reading the rail that had stopped
  // receiving charges, and reported zero unpaid Pix while real ones piled up in
  // the other table. TAT-187 dropped that table; the three arrangements here are
  // what the one surviving query has to tell apart.
  it("counts an unpaid Asaas Pix charge, the rail that replaced AbacatePay", async () => {
    const { owner, academy } = await seedAcademy();
    const plan = makeSubscriptionPlan({ academyId: academy.id });
    await ctx.db.insert(subscriptionPlans).values(plan);
    // One subscription per state, not three rows on one. The three arrangements
    // below cannot share a subscription and a month —
    // `pending_asaas_payments_subscription_month_unique` forbids it, and the
    // service deletes the open row before opening another — so stacking them
    // would be asserting against a state production cannot reach. What the
    // query has to tell apart is still exercised: unpaid, settled, and a
    // checkout that is not a Pix at all.
    const unpaid = makeStudentSubscription({ userId: owner.id, planId: plan.id });
    const settled = makeStudentSubscription({ userId: owner.id, planId: plan.id });
    const card = makeStudentSubscription({ userId: owner.id, planId: plan.id });
    await ctx.db
      .insert(studentSubscriptions)
      .values([unpaid, settled, card]);

    await ctx.db.insert(pendingAsaasPayments).values([
      {
        asaasPaymentId: "pay_unpaid",
        kind: "payment",
        subscriptionId: unpaid.id,
        userId: owner.id,
        academyId: academy.id,
        referenceMonth: "2026-09-01",
        amountCents: 12_000,
        createdAt: INSIDE,
      },
      {
        asaasPaymentId: "pay_paid",
        kind: "payment",
        subscriptionId: settled.id,
        userId: owner.id,
        academyId: academy.id,
        referenceMonth: "2026-09-01",
        amountCents: 30_000,
        createdAt: INSIDE,
      },
      // A card checkout is not a Pix. It belongs to the same table, told apart
      // by `kind`, and counting it would quietly change what the number means.
      {
        asaasPaymentId: "sess_card",
        kind: "checkout",
        subscriptionId: card.id,
        userId: owner.id,
        academyId: academy.id,
        referenceMonth: "2026-09-01",
        amountCents: 50_000,
        createdAt: INSIDE,
      },
    ]);
    await ctx.db.insert(payments).values(
      makePayment({
        subscriptionId: settled.id,
        userId: owner.id,
        academyId: academy.id,
        confirmedBy: null,
        method: "pix",
        amountCents: 30_000,
        stripePaymentId: null,
        asaasPaymentId: "pay_paid",
        paidAt: INSIDE,
      }),
    );

    const rows = await repo.unpaidPixPerAcademy(window);

    expect(rows).toEqual([
      { academyId: academy.id, count: 1, amountCents: 12_000 },
    ]);
  });

  // The window predicate had no case of its own while the number was two rails
  // summed, because no test ever put a pending row outside the day. Dropping
  // either `gte`/`lt` would have left every test above green.
  it("leaves an Asaas charge opened before the BRT day out", async () => {
    const { owner, academy } = await seedAcademy();
    const plan = makeSubscriptionPlan({ academyId: academy.id });
    await ctx.db.insert(subscriptionPlans).values(plan);
    const sub = makeStudentSubscription({ userId: owner.id, planId: plan.id });
    await ctx.db.insert(studentSubscriptions).values(sub);

    await ctx.db.insert(pendingAsaasPayments).values({
      asaasPaymentId: "pay_previous_day",
      kind: "payment",
      subscriptionId: sub.id,
      userId: owner.id,
      academyId: academy.id,
      referenceMonth: "2026-09-01",
      amountCents: 12_000,
      createdAt: LATE_PREVIOUS_BRT,
    });

    expect(await repo.unpaidPixPerAcademy(window)).toEqual([]);
  });

  // The upper bound had no case either, and its absence is worse than the lower
  // bound's: `collectDay` reads two windows to compare today against yesterday,
  // so a query with no `window.end` makes both numbers "everything unpaid since
  // `start`" — they grow without bound and the comparison stops meaning
  // anything, with every other test in this file still green. Verified: the
  // mutant that drops the bound survives the whole suite without this case.
  it("leaves an Asaas charge opened at the exact end of the window out", async () => {
    const { owner, academy } = await seedAcademy();
    const plan = makeSubscriptionPlan({ academyId: academy.id });
    await ctx.db.insert(subscriptionPlans).values(plan);
    const sub = makeStudentSubscription({ userId: owner.id, planId: plan.id });
    await ctx.db.insert(studentSubscriptions).values(sub);

    await ctx.db.insert(pendingAsaasPayments).values({
      asaasPaymentId: "pay_next_day",
      kind: "payment",
      subscriptionId: sub.id,
      userId: owner.id,
      academyId: academy.id,
      referenceMonth: "2026-09-01",
      amountCents: 12_000,
      createdAt: WINDOW_END,
    });

    expect(await repo.unpaidPixPerAcademy(window)).toEqual([]);
  });

  // The per-academy grouping was carried by a merge over two result sets, which
  // this change replaced with the `groupBy` alone. Two academies is what tells
  // one row each from one row with both amounts added together.
  it("keeps each academy's unpaid Pix on its own row", async () => {
    const first = await seedAcademy({ name: "Academia Um" });
    const second = await seedAcademy({ name: "Academia Dois" });

    for (const [i, seeded] of [first, second].entries()) {
      const plan = makeSubscriptionPlan({ academyId: seeded.academy.id });
      await ctx.db.insert(subscriptionPlans).values(plan);
      const sub = makeStudentSubscription({
        userId: seeded.owner.id,
        planId: plan.id,
      });
      await ctx.db.insert(studentSubscriptions).values(sub);
      await ctx.db.insert(pendingAsaasPayments).values({
        asaasPaymentId: `pay_academy_${i}`,
        kind: "payment",
        subscriptionId: sub.id,
        userId: seeded.owner.id,
        academyId: seeded.academy.id,
        referenceMonth: "2026-09-01",
        amountCents: 10_000 * (i + 1),
        createdAt: INSIDE,
      });
    }

    const rows = await repo.unpaidPixPerAcademy(window);

    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        { academyId: first.academy.id, count: 1, amountCents: 10_000 },
        { academyId: second.academy.id, count: 1, amountCents: 20_000 },
      ]),
    );
  });

  it("counts a student as overdue only with no payment for the month", async () => {
    const { academy } = await seedAcademy();
    const plan = makeSubscriptionPlan({ academyId: academy.id });
    await ctx.db.insert(subscriptionPlans).values(plan);

    const paidUser = makeUser();
    const unpaidUser = makeUser();
    await ctx.db.insert(users).values([paidUser, unpaidUser]);

    const paidSub = makeStudentSubscription({
      userId: paidUser.id,
      planId: plan.id,
      status: "active",
      expiresAt: "2026-12-31",
    });
    const unpaidSub = makeStudentSubscription({
      userId: unpaidUser.id,
      planId: plan.id,
      status: "active",
      expiresAt: "2026-12-31",
    });
    await ctx.db.insert(studentSubscriptions).values([paidSub, unpaidSub]);
    await ctx.db.insert(payments).values(
      makePayment({
        subscriptionId: paidSub.id,
        userId: paidUser.id,
        academyId: academy.id,
        confirmedBy: null,
        referenceMonth: "2026-09-01",
        paidAt: INSIDE,
      }),
    );

    const rows = await repo.overdueStudentsPerAcademy("2026-09-01", DAY);

    expect(rows).toEqual([{ academyId: academy.id, count: 1 }]);
  });

  it("attributes check-ins to the academy that owns the class", async () => {
    const { owner, academy } = await seedAcademy();
    const student = makeUser();
    await ctx.db.insert(users).values(student);
    const gi = makeClass({
      academyId: academy.id,
      instructorId: owner.id,
      name: "Adulto Noite",
    });
    const noGi = makeClass({
      academyId: academy.id,
      instructorId: owner.id,
      name: "No-Gi",
    });
    await ctx.db.insert(classes).values([gi, noGi]);
    await ctx.db.insert(checkins).values([
      makeCheckin({ classId: gi.id, userId: student.id, date: DAY }),
      makeCheckin({ classId: gi.id, userId: owner.id, date: DAY }),
      makeCheckin({ classId: noGi.id, userId: student.id, date: DAY }),
      makeCheckin({ classId: gi.id, userId: student.id, date: "2026-09-10" }),
    ]);

    expect(await repo.checkinsPerAcademy(window)).toEqual([
      { academyId: academy.id, count: 3 },
    ]);
    expect(await repo.classAttendancePerAcademy(window)).toEqual([
      { academyId: academy.id, className: "Adulto Noite", count: 2 },
      { academyId: academy.id, className: "No-Gi", count: 1 },
    ]);
  });

  it("counts students who joined inside the window", async () => {
    const { academy } = await seedAcademy();
    const inside = makeUser();
    const outside = makeUser();
    const instructor = makeUser();
    await ctx.db.insert(users).values([inside, outside, instructor]);
    await ctx.db.insert(academyMemberships).values([
      makeMembership({
        academyId: academy.id,
        userId: inside.id,
        role: "student",
        joinedAt: INSIDE,
      }),
      makeMembership({
        academyId: academy.id,
        userId: outside.id,
        role: "student",
        joinedAt: LATE_PREVIOUS_BRT,
      }),
      makeMembership({
        academyId: academy.id,
        userId: instructor.id,
        role: "instructor",
        joinedAt: INSIDE,
      }),
    ]);

    expect(await repo.newStudentsPerAcademy(window)).toEqual([
      { academyId: academy.id, count: 1 },
    ]);
  });

  it("reports the academy with its owner and manager plan", async () => {
    const { owner, academy } = await seedAcademy({ name: "Alpha Team" });
    await ctx.db
      .insert(managerSubscriptions)
      .values(
        makeManagerSubscription({ academyId: academy.id, plan: "pro", status: "active" }),
      );

    expect(await repo.listAcademies()).toEqual([
      {
        id: academy.id,
        name: "Alpha Team",
        ownerName: owner.name,
        managerPlan: "pro",
      },
    ]);
    expect(await repo.countManagerSubscriptions()).toEqual({ pro: 1, free: 0 });
  });
});
