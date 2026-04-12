import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  makeAcademy,
  makePayment,
  makeStudentSubscription,
  makeSubscriptionPlan,
} from "../../testing/factories/index.js";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import {
  InMemoryStudentSubscriptionRepository,
  InMemorySubscriptionPlanRepository,
} from "../subscription/subscription.repository.in-memory.js";
import { InMemoryPaymentRepository } from "./payment.repository.in-memory.js";
import { PaymentService } from "./payment.service.js";

describe("PaymentService", () => {
  it("confirmManual creates payment when manager owns academy", async () => {
    const managerId = randomUUID();
    const academy = makeAcademy({ ownerId: managerId });
    const planRows = [makeSubscriptionPlan({ academyId: academy.id })];
    const planRepo = new InMemorySubscriptionPlanRepository(planRows);
    const subRows = [
      makeStudentSubscription({
        userId: randomUUID(),
        planId: planRows[0]!.id,
        status: "active",
      }),
    ];
    const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, subRows);
    const payRows: import("./payment.repository.js").PaymentRow[] = [];
    const payRepo = new InMemoryPaymentRepository(payRows);
    const svc = new PaymentService(
      payRepo,
      subRepo,
      new InMemoryAcademyRepository([academy]),
    );

    const row = await svc.confirmManual(managerId, academy.id, {
      subscriptionId: subRows[0]!.id,
      amountCents: 5000,
      referenceMonth: "2026-03-01",
      notes: null,
    });
    expect(row.amountCents).toBe(5000);
    expect(payRows).toHaveLength(1);
  });

  it("confirmManual returns 404 when subscription in another academy", async () => {
    const managerId = randomUUID();
    const academy = makeAcademy({ ownerId: managerId });
    const otherAcademy = makeAcademy();
    const planRows = [makeSubscriptionPlan({ academyId: otherAcademy.id })];
    const planRepo = new InMemorySubscriptionPlanRepository(planRows);
    const sub = makeStudentSubscription({
      planId: planRows[0]!.id,
      status: "active",
    });
    const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, [sub]);
    const svc = new PaymentService(
      new InMemoryPaymentRepository([]),
      subRepo,
      new InMemoryAcademyRepository([academy]),
    );

    await expect(
      svc.confirmManual(managerId, academy.id, {
        subscriptionId: sub.id,
        amountCents: 100,
        referenceMonth: "2026-03-01",
        notes: null,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("listForStudent filters by userId", async () => {
    const academyId = randomUUID();
    const studentId = randomUUID();
    const otherId = randomUUID();
    const rows = [
      makePayment({ academyId, userId: studentId }),
      makePayment({ academyId, userId: otherId }),
    ];
    const svc = new PaymentService(
      new InMemoryPaymentRepository(rows),
      new InMemoryStudentSubscriptionRepository(
        new InMemorySubscriptionPlanRepository([]),
        [],
      ),
      new InMemoryAcademyRepository([]),
    );
    const list = await svc.listForStudent(studentId, academyId);
    expect(list).toHaveLength(1);
    expect(list[0]!.userId).toBe(studentId);
  });

  it("confirmManual returns 404 when subscription does not exist", async () => {
    const managerId = randomUUID();
    const academy = makeAcademy({ ownerId: managerId });
    const planRepo = new InMemorySubscriptionPlanRepository([]);
    const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, []);
    const svc = new PaymentService(
      new InMemoryPaymentRepository([]),
      subRepo,
      new InMemoryAcademyRepository([academy]),
    );

    await expect(
      svc.confirmManual(managerId, academy.id, {
        subscriptionId: randomUUID(),
        amountCents: 5000,
        referenceMonth: "2026-03-01",
        notes: null,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("confirmManual returns 400 when paidAt is invalid", async () => {
    const managerId = randomUUID();
    const academy = makeAcademy({ ownerId: managerId });
    const planRows = [makeSubscriptionPlan({ academyId: academy.id })];
    const planRepo = new InMemorySubscriptionPlanRepository(planRows);
    const subRows = [
      makeStudentSubscription({
        userId: randomUUID(),
        planId: planRows[0]!.id,
        status: "active",
      }),
    ];
    const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, subRows);
    const svc = new PaymentService(
      new InMemoryPaymentRepository([]),
      subRepo,
      new InMemoryAcademyRepository([academy]),
    );

    await expect(
      svc.confirmManual(managerId, academy.id, {
        subscriptionId: subRows[0]!.id,
        amountCents: 5000,
        referenceMonth: "2026-03-01",
        notes: null,
        paidAt: "not-a-date",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("confirmManual returns 403 when manager does not own academy", async () => {
    const managerId = randomUUID();
    const otherUserId = randomUUID();
    const academy = makeAcademy({ ownerId: otherUserId });
    const planRows = [makeSubscriptionPlan({ academyId: academy.id })];
    const planRepo = new InMemorySubscriptionPlanRepository(planRows);
    const subRows = [
      makeStudentSubscription({
        userId: randomUUID(),
        planId: planRows[0]!.id,
        status: "active",
      }),
    ];
    const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, subRows);
    const svc = new PaymentService(
      new InMemoryPaymentRepository([]),
      subRepo,
      new InMemoryAcademyRepository([academy]),
    );

    await expect(
      svc.confirmManual(managerId, academy.id, {
        subscriptionId: subRows[0]!.id,
        amountCents: 5000,
        referenceMonth: "2026-03-01",
        notes: null,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("listForManager succeeds when manager owns academy", async () => {
    const managerId = randomUUID();
    const academy = makeAcademy({ ownerId: managerId });
    const svc = new PaymentService(
      new InMemoryPaymentRepository([]),
      new InMemoryStudentSubscriptionRepository(
        new InMemorySubscriptionPlanRepository([]),
        [],
      ),
      new InMemoryAcademyRepository([academy]),
    );

    const list = await svc.listForManager(managerId, academy.id, {});
    expect(Array.isArray(list)).toBe(true);
  });

  it("listForManager returns 403 when user is not owner", async () => {
    const managerId = randomUUID();
    const otherUserId = randomUUID();
    const academy = makeAcademy({ ownerId: otherUserId });
    const svc = new PaymentService(
      new InMemoryPaymentRepository([]),
      new InMemoryStudentSubscriptionRepository(
        new InMemorySubscriptionPlanRepository([]),
        [],
      ),
      new InMemoryAcademyRepository([academy]),
    );

    await expect(
      svc.listForManager(managerId, academy.id, {}),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
