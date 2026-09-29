import {
  academies,
  academyMemberships,
  checkins,
  classes,
  managerSubscriptions,
  payments,
  pendingAsaasPayments,
  pendingPixPayments,
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
        method: "card",
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
    const card = rows.find((r) => r.method === "card");

    expect(pix).toMatchObject({ count: 2, amountCents: 15_000 });
    expect(card).toMatchObject({ count: 1, amountCents: 20_000 });
  });

  it("counts only untransferred card and Pix payments as owed", async () => {
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
      makePayment({ ...base, method: "pix", amountCents: 10_000 }),
      makePayment({
        ...base,
        method: "pix",
        amountCents: 7_000,
        transferredAt: INSIDE,
      }),
      makePayment({ ...base, method: "manual", amountCents: 50_000 }),
    ]);

    const rows = await repo.pendingTransfersPerAcademy();

    expect(rows).toEqual([
      {
        academyId: academy.id,
        method: "pix",
        count: 1,
        amountCents: 10_000,
      },
    ]);
  });

  it("counts a Pix QR code as unpaid only while no payment references it", async () => {
    const { owner, academy } = await seedAcademy();
    const plan = makeSubscriptionPlan({ academyId: academy.id });
    await ctx.db.insert(subscriptionPlans).values(plan);
    const sub = makeStudentSubscription({ userId: owner.id, planId: plan.id });
    await ctx.db.insert(studentSubscriptions).values(sub);

    await ctx.db.insert(pendingPixPayments).values([
      {
        pixQrCodeId: "pix_unpaid",
        subscriptionId: sub.id,
        userId: owner.id,
        academyId: academy.id,
        referenceMonth: "2026-09-01",
        amountCents: 12_000,
        createdAt: INSIDE,
      },
      {
        pixQrCodeId: "pix_paid",
        subscriptionId: sub.id,
        userId: owner.id,
        academyId: academy.id,
        referenceMonth: "2026-09-01",
        amountCents: 30_000,
        createdAt: INSIDE,
      },
    ]);
    await ctx.db.insert(payments).values(
      makePayment({
        subscriptionId: sub.id,
        userId: owner.id,
        academyId: academy.id,
        confirmedBy: null,
        method: "pix",
        amountCents: 30_000,
        stripePaymentId: "pix_paid",
        paidAt: INSIDE,
      }),
    );

    const rows = await repo.unpaidPixPerAcademy(window);

    expect(rows).toEqual([
      { academyId: academy.id, count: 1, amountCents: 12_000 },
    ]);
  });

  // The rail this metric was written for is gone. `POST /payments/pix` writes
  // `pending_asaas_payments` now, so a summary that reads only the AbacatePay
  // table reports zero unpaid Pix forever while real ones pile up unseen.
  it("counts an unpaid Asaas Pix charge, the rail that replaced AbacatePay", async () => {
    const { owner, academy } = await seedAcademy();
    const plan = makeSubscriptionPlan({ academyId: academy.id });
    await ctx.db.insert(subscriptionPlans).values(plan);
    const sub = makeStudentSubscription({ userId: owner.id, planId: plan.id });
    await ctx.db.insert(studentSubscriptions).values(sub);

    await ctx.db.insert(pendingAsaasPayments).values([
      {
        asaasPaymentId: "pay_unpaid",
        kind: "payment",
        subscriptionId: sub.id,
        userId: owner.id,
        academyId: academy.id,
        referenceMonth: "2026-09-01",
        amountCents: 12_000,
        createdAt: INSIDE,
      },
      {
        asaasPaymentId: "pay_paid",
        kind: "payment",
        subscriptionId: sub.id,
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
        subscriptionId: sub.id,
        userId: owner.id,
        academyId: academy.id,
        referenceMonth: "2026-09-01",
        amountCents: 50_000,
        createdAt: INSIDE,
      },
    ]);
    await ctx.db.insert(payments).values(
      makePayment({
        subscriptionId: sub.id,
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

  // The cutover is not instant: AbacatePay QR codes created before it are still
  // payable, so for as long as any are open the number has to be both rails.
  it("sums both rails while AbacatePay charges are still draining", async () => {
    const { owner, academy } = await seedAcademy();
    const plan = makeSubscriptionPlan({ academyId: academy.id });
    await ctx.db.insert(subscriptionPlans).values(plan);
    const sub = makeStudentSubscription({ userId: owner.id, planId: plan.id });
    await ctx.db.insert(studentSubscriptions).values(sub);

    await ctx.db.insert(pendingPixPayments).values({
      pixQrCodeId: "pix_char_old",
      subscriptionId: sub.id,
      userId: owner.id,
      academyId: academy.id,
      referenceMonth: "2026-09-01",
      amountCents: 7_000,
      createdAt: INSIDE,
    });
    await ctx.db.insert(pendingAsaasPayments).values({
      asaasPaymentId: "pay_new",
      kind: "payment",
      subscriptionId: sub.id,
      userId: owner.id,
      academyId: academy.id,
      referenceMonth: "2026-09-01",
      amountCents: 12_000,
      createdAt: INSIDE,
    });

    const rows = await repo.unpaidPixPerAcademy(window);

    expect(rows).toEqual([
      { academyId: academy.id, count: 2, amountCents: 19_000 },
    ]);
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
