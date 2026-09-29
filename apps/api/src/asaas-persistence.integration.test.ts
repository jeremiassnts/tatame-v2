import {
  academies,
  payments,
  studentSubscriptions,
  subscriptionPlans,
  users,
} from "@tatame/db/schema";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { InMemoryPaymentRepository } from "./modules/payment/payment.repository.in-memory.js";
import type { IPaymentRepository } from "./modules/payment/payment.repository.js";
import { PostgresPaymentRepository } from "./modules/payment/payment.repository.postgres.js";
import { InMemoryUserRepository } from "./modules/user/user.repository.in-memory.js";
import type { IUserRepository } from "./modules/user/user.repository.js";
import { PostgresUserRepository } from "./modules/user/user.repository.postgres.js";
import {
  makeAcademy,
  makeStudentSubscription,
  makeSubscriptionPlan,
  makeUser,
} from "./testing/factories/index.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

const REFERENCE_MONTH = "2026-10-01";

type Ids = {
  subscriptionId: string;
  userId: string;
  academyId: string;
};

/**
 * The in-memory repository is what every service unit test runs against and
 * Postgres is what production runs against. Anywhere they disagree, the unit
 * tests are measuring a fiction — so the Asaas methods are specified once and
 * both implementations are held to it.
 */
function describeContract(
  name: string,
  makeRepo: () => IPaymentRepository,
  ids: () => Ids,
) {
  describe(name, () => {
    it("round-trips a pending charge and forgets it once deleted", async () => {
      const repo = makeRepo();
      const { subscriptionId, userId, academyId } = ids();

      await repo.createPendingAsaas({
        asaasPaymentId: "pay_contract_1",
        subscriptionId,
        userId,
        academyId,
        referenceMonth: REFERENCE_MONTH,
        amountCents: 15_000,
      });

      expect(await repo.findPendingAsaasByPaymentId("pay_contract_1")).toEqual({
        asaasPaymentId: "pay_contract_1",
        subscriptionId,
        userId,
        academyId,
        referenceMonth: REFERENCE_MONTH,
        amountCents: 15_000,
      });

      await repo.deletePendingAsaas("pay_contract_1");
      expect(
        await repo.findPendingAsaasByPaymentId("pay_contract_1"),
      ).toBeUndefined();
    });

    it("returns undefined for a pending charge it never saw", async () => {
      const repo = makeRepo();
      expect(await repo.findPendingAsaasByPaymentId("pay_ghost")).toBeUndefined();
    });

    // Asaas retries, and a charge creation that timed out after Asaas already
    // answered comes back with the same id. Writing it twice must not throw.
    it("accepts the same pending charge twice", async () => {
      const repo = makeRepo();
      const { subscriptionId, userId, academyId } = ids();
      const row = {
        asaasPaymentId: "pay_contract_dup",
        subscriptionId,
        userId,
        academyId,
        referenceMonth: REFERENCE_MONTH,
        amountCents: 15_000,
      };

      await repo.createPendingAsaas(row);
      await repo.createPendingAsaas(row);

      expect(
        await repo.findPendingAsaasByPaymentId("pay_contract_dup"),
      ).toEqual(row);
    });

    // What B4 reuses instead of opening a second charge for a month that
    // already has one waiting to be paid.
    it("finds the open charge for a subscription and month", async () => {
      const repo = makeRepo();
      const { subscriptionId, userId, academyId } = ids();

      await repo.createPendingAsaas({
        asaasPaymentId: "pay_contract_open",
        subscriptionId,
        userId,
        academyId,
        referenceMonth: REFERENCE_MONTH,
        amountCents: 15_000,
      });

      const open = await repo.findPendingAsaasBySubscriptionMonth(
        subscriptionId,
        REFERENCE_MONTH,
      );
      expect(open?.asaasPaymentId).toBe("pay_contract_open");

      expect(
        await repo.findPendingAsaasBySubscriptionMonth(
          subscriptionId,
          "2026-11-01",
        ),
      ).toBeUndefined();

      await repo.deletePendingAsaas("pay_contract_open");
      expect(
        await repo.findPendingAsaasBySubscriptionMonth(
          subscriptionId,
          REFERENCE_MONTH,
        ),
      ).toBeUndefined();
    });

    it("stores and finds a payment by its asaas id", async () => {
      const repo = makeRepo();
      const { subscriptionId, userId, academyId } = ids();

      const created = await repo.create({
        subscriptionId,
        userId,
        academyId,
        amountCents: 15_000,
        method: "pix",
        confirmedBy: null,
        stripePaymentId: null,
        asaasPaymentId: "pay_contract_paid",
        referenceMonth: REFERENCE_MONTH,
        notes: null,
        paidAt: new Date(),
      });

      expect(created.asaasPaymentId).toBe("pay_contract_paid");
      expect(
        (await repo.findByAsaasPaymentId("pay_contract_paid"))?.id,
      ).toBe(created.id);
      expect(await repo.findByAsaasPaymentId("pay_nothing")).toBeUndefined();
    });

    it("leaves the asaas id null on a payment that did not come from asaas", async () => {
      const repo = makeRepo();
      const { subscriptionId, userId, academyId } = ids();

      const created = await repo.create({
        subscriptionId,
        userId,
        academyId,
        amountCents: 15_000,
        method: "manual",
        confirmedBy: null,
        stripePaymentId: null,
        referenceMonth: REFERENCE_MONTH,
        notes: null,
        paidAt: new Date(),
      });

      expect(created.asaasPaymentId).toBeNull();
    });
  });
}

function describeUserContract(name: string, makeRepo: () => IUserRepository) {
  describe(name, () => {
    it("persists the asaas customer id and reads it back", async () => {
      const repo = makeRepo();
      await repo.upsert({
        clerkUserId: "user_asaas_customer_contract",
        email: "asaas-customer-contract@example.com",
        name: "Aluno Contrato",
        profileImageUrl: null,
      });

      const created = await repo.findByClerkId("user_asaas_customer_contract");
      expect(created?.asaasCustomerId).toBeNull();

      await repo.updateAsaasCustomerId(created!.id, "cus_000009262465");

      const reread = await repo.findById(created!.id);
      expect(reread?.asaasCustomerId).toBe("cus_000009262465");
    });
  });
}

describe("Asaas payment repository methods", () => {
  let ctx: Awaited<ReturnType<typeof setupIntegrationTest>>;
  let ids: Ids;

  beforeAll(async () => {
    ctx = await setupIntegrationTest();
  });

  afterAll(async () => {
    await ctx.dropSchema();
  });

  beforeEach(async () => {
    await ctx.truncateAll();

    const user = makeUser({});
    const academy = makeAcademy({ ownerId: user.id });
    const plan = makeSubscriptionPlan({ academyId: academy.id });
    const subscription = makeStudentSubscription({
      userId: user.id,
      planId: plan.id,
    });

    await ctx.db.insert(users).values(user);
    await ctx.db.insert(academies).values(academy);
    await ctx.db.insert(subscriptionPlans).values(plan);
    await ctx.db.insert(studentSubscriptions).values(subscription);

    ids = {
      subscriptionId: subscription.id,
      userId: user.id,
      academyId: academy.id,
    };
  });

  describeContract(
    "PostgresPaymentRepository",
    () => new PostgresPaymentRepository(ctx.db),
    () => ids,
  );

  describeContract(
    "InMemoryPaymentRepository",
    () => new InMemoryPaymentRepository(),
    () => ids,
  );

  describeUserContract(
    "PostgresUserRepository",
    () => new PostgresUserRepository(ctx.db),
  );

  describeUserContract(
    "InMemoryUserRepository",
    () => new InMemoryUserRepository(),
  );

  // Only Postgres can answer this one, and it is the reason the column carries
  // a unique constraint at all: Asaas delivers `PAYMENT_CONFIRMED` and then
  // `PAYMENT_RECEIVED` for the same money, so the database — not a check inside
  // the handler — is what keeps that to one payment row.
  it("refuses a second payment row for the same asaas charge", async () => {
    const repo = new PostgresPaymentRepository(ctx.db);
    const base = {
      subscriptionId: ids.subscriptionId,
      userId: ids.userId,
      academyId: ids.academyId,
      amountCents: 15_000,
      method: "pix" as const,
      confirmedBy: null,
      stripePaymentId: null,
      referenceMonth: REFERENCE_MONTH,
      notes: null,
      paidAt: new Date(),
    };

    await repo.create({ ...base, asaasPaymentId: "pay_unique" });
    await expect(
      repo.create({ ...base, asaasPaymentId: "pay_unique" }),
    ).rejects.toThrow();
  });

  it("allows many payments with no asaas charge behind them", async () => {
    const repo = new PostgresPaymentRepository(ctx.db);
    const base = {
      subscriptionId: ids.subscriptionId,
      userId: ids.userId,
      academyId: ids.academyId,
      amountCents: 15_000,
      method: "manual" as const,
      confirmedBy: null,
      stripePaymentId: null,
      referenceMonth: REFERENCE_MONTH,
      notes: null,
      paidAt: new Date(),
    };

    await repo.create(base);
    await repo.create(base);

    const rows = await ctx.db.select().from(payments);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.asaasPaymentId === null)).toBe(true);
  });
});
