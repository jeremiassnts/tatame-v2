import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { HttpError } from "../../lib/http-error.js";
import { makeAcademy, makeSubscriptionPlan } from "../../testing/factories/index.js";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import { InMemoryPayoutAccountRepository } from "../payout-account/payout-account.repository.in-memory.js";
import type { PayoutAccountStatus } from "../payout-account/payout-account.repository.js";
import {
  InMemoryStudentSubscriptionRepository,
  InMemorySubscriptionPlanRepository,
} from "./subscription.repository.in-memory.js";
import { SubscriptionService } from "./subscription.service.js";

/**
 * The invariant the whole feature protects: a plan whose academy has nowhere
 * to receive money must not exist, and nobody may enrol in one.
 */
async function setup(
  opts: {
    payoutStatus?: PayoutAccountStatus | "none";
    requirePayoutAccount?: boolean;
  } = {},
) {
  const managerId = randomUUID();
  const academy = makeAcademy({ ownerId: managerId });
  const plan = makeSubscriptionPlan({ academyId: academy.id });
  const planRepo = new InMemorySubscriptionPlanRepository([plan]);
  const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, []);
  const academyRepo = new InMemoryAcademyRepository([academy]);
  const payoutRepo = new InMemoryPayoutAccountRepository();

  const status = opts.payoutStatus ?? "approved";
  if (status !== "none") {
    await payoutRepo.create({
      academyId: academy.id,
      externalAccountId: "acc_1",
      walletId: "wal_1",
      apiKeyEncrypted: "sealed",
      status,
    });
  }

  const svc = new SubscriptionService(
    planRepo,
    subRepo,
    academyRepo,
    undefined,
    payoutRepo,
    { requirePayoutAccount: opts.requirePayoutAccount ?? true },
  );
  return { svc, managerId, academy, plan, planRepo };
}

const PLAN_BODY = {
  name: "Mensal",
  recurrenceMonths: 1 as const,
  priceCents: 15000,
};

describe("createPlan requires a receiving account", () => {
  it("creates the plan when the academy can receive", async () => {
    const { svc, managerId, academy } = await setup();
    const plan = await svc.createPlan(managerId, academy.id, PLAN_BODY);
    expect(plan.name).toBe("Mensal");
  });

  it.each(["pending", "awaiting_documents", "under_review", "rejected", "suspended"] as const)(
    "refuses with 403 PAYOUT_ACCOUNT_REQUIRED while the account is %s",
    async (payoutStatus) => {
      const { svc, managerId, academy, planRepo } = await setup({ payoutStatus });

      const error = (await svc
        .createPlan(managerId, academy.id, PLAN_BODY)
        .catch((e: unknown) => e)) as HttpError;

      expect(error.statusCode).toBe(403);
      expect(error.details).toMatchObject({ code: "PAYOUT_ACCOUNT_REQUIRED" });
      expect(await planRepo.findByAcademy(academy.id, { includeInactive: true })).toHaveLength(1);
    },
  );

  it("refuses when the academy has no account at all", async () => {
    const { svc, managerId, academy } = await setup({ payoutStatus: "none" });

    const error = (await svc
      .createPlan(managerId, academy.id, PLAN_BODY)
      .catch((e: unknown) => e)) as HttpError;

    expect(error.statusCode).toBe(403);
    expect(error.details).toMatchObject({ code: "PAYOUT_ACCOUNT_REQUIRED" });
  });
});

describe("selectPlan requires a receiving account", () => {
  it("enrols the student when the academy can receive", async () => {
    const { svc, academy, plan } = await setup();
    const { subscription } = await svc.selectPlan(randomUUID(), academy.id, plan.id);
    expect(subscription.planId).toBe(plan.id);
  });

  it("refuses a new enrolment with 403 PAYOUT_ACCOUNT_REQUIRED", async () => {
    const { svc, academy, plan } = await setup({ payoutStatus: "pending" });

    const error = (await svc
      .selectPlan(randomUUID(), academy.id, plan.id)
      .catch((e: unknown) => e)) as HttpError;

    expect(error.statusCode).toBe(403);
    expect(error.details).toMatchObject({ code: "PAYOUT_ACCOUNT_REQUIRED" });
  });

  it("refuses when the academy has no account at all", async () => {
    const { svc, academy, plan } = await setup({ payoutStatus: "none" });
    const error = (await svc
      .selectPlan(randomUUID(), academy.id, plan.id)
      .catch((e: unknown) => e)) as HttpError;
    expect(error.statusCode).toBe(403);
  });
});

describe("without a payout repository wired", () => {
  it("leaves both flows open, so existing deployments keep working", async () => {
    const managerId = randomUUID();
    const academy = makeAcademy({ ownerId: managerId });
    const plan = makeSubscriptionPlan({ academyId: academy.id });
    const planRepo = new InMemorySubscriptionPlanRepository([plan]);
    const svc = new SubscriptionService(
      planRepo,
      new InMemoryStudentSubscriptionRepository(planRepo, []),
      new InMemoryAcademyRepository([academy]),
    );

    await expect(svc.createPlan(managerId, academy.id, PLAN_BODY)).resolves.toBeDefined();
    await expect(svc.selectPlan(randomUUID(), academy.id, plan.id)).resolves.toBeDefined();
  });
});

/**
 * The requirement can only be satisfied through the onboarding flow in the
 * mobile app, and a store release does not land with the API deploy. Until
 * that version is adopted the rule has to stay off, or every manager on an
 * older build loses plan creation and every new enrolment fails, with no
 * reachable way to fix it.
 */
describe("with the requirement turned off", () => {
  it("creates the plan even though the academy cannot receive", async () => {
    const { svc, managerId, academy } = await setup({
      payoutStatus: "none",
      requirePayoutAccount: false,
    });

    await expect(
      svc.createPlan(managerId, academy.id, PLAN_BODY),
    ).resolves.toMatchObject({ name: "Mensal" });
  });

  it("enrols the student even though the academy cannot receive", async () => {
    const { svc, academy, plan } = await setup({
      payoutStatus: "none",
      requirePayoutAccount: false,
    });

    const { subscription } = await svc.selectPlan(randomUUID(), academy.id, plan.id);
    expect(subscription.planId).toBe(plan.id);
  });

  it("still refuses once the requirement is turned back on", async () => {
    const { svc, managerId, academy } = await setup({
      payoutStatus: "none",
      requirePayoutAccount: true,
    });

    const error = (await svc
      .createPlan(managerId, academy.id, PLAN_BODY)
      .catch((e: unknown) => e)) as HttpError;

    expect(error.statusCode).toBe(403);
    expect(error.details).toMatchObject({ code: "PAYOUT_ACCOUNT_REQUIRED" });
  });
});
