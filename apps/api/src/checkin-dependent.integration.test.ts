import { vi } from "vitest";
import {
  asClerkUser,
  resetIntegrationClerkAuth,
} from "./testing/integration-clerk-mock.js";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setDbForTest } from "./lib/db.js";
import {
  insertApprovedPayoutAccount,
  insertSubscription,
  insertUserWithGlobalRole,
} from "./testing/integration-seed.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";
import { checkins } from "@tatame/db/schema";
import { PostgresCheckinRepository } from "./modules/checkin/checkin.repository.postgres.js";
import { mondayOfWeekContaining } from "./modules/checkin/checkin.service.js";

vi.mock("./lib/lock.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./lib/lock.js")>();
  return {
    ...mod,
    withCheckinLock: async (
      _r: unknown,
      _classId: unknown,
      _date: unknown,
      fn: () => Promise<unknown>,
    ) => fn(),
  };
});

vi.mock("./lib/redis.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./lib/redis.js")>();
  return {
    ...mod,
    requireRedisForCheckin: async () =>
      ({}) as import("redis").RedisClientType,
  };
});

const CLERK_MANAGER = "user_integration_ckdep_mgr";
const CLERK_STUDENT = "user_integration_ckdep_std";

function utcMonthFirstIso(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/**
 * TAT-181. A dependent's check-in row carries the guardian's `user_id`, so
 * every query that filters on `user_id` alone folded the child's training into
 * the parent's: their weekly allowance, their weekly count and their history.
 */
describe("Check-in: account holder vs dependent", () => {
  let app: import("express").Express;
  let ctx: Awaited<ReturnType<typeof setupIntegrationTest>>;

  beforeAll(async () => {
    ctx = await setupIntegrationTest();
    setDbForTest(ctx.db);
    const { createApp } = await import("./app.js");
    app = createApp();
  });

  beforeEach(async () => {
    await ctx.truncateAll();
    resetIntegrationClerkAuth();
  });

  afterAll(async () => {
    await ctx.dropSchema();
  });

  /**
   * An academy holding an adult plan and a kids plan, both capped at two
   * check-ins a week, plus two all-day classes today so that two sessions can
   * be taken on the same date. The student is enrolled in the adult plan and
   * their dependent in the kids plan, both paid for the current month.
   */
  async function seedHousehold(): Promise<{
    studentId: string;
    dependentId: string;
    morningClassId: string;
    eveningClassId: string;
    sessionDate: string;
  }> {
    const manager = await insertUserWithGlobalRole(
      ctx.db,
      CLERK_MANAGER,
      "manager",
    );
    const student = await insertUserWithGlobalRole(
      ctx.db,
      CLERK_STUDENT,
      "student",
    );

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Household Dojo" });
    expect(ac.status).toBe(201);
    const academyId = ac.body.id as string;

    // Pro: the free tier caps an academy at one plan and this needs two.
    await insertSubscription(ctx.db, academyId, { plan: "pro" });
    await insertApprovedPayoutAccount(ctx.db, academyId);

    asClerkUser(CLERK_STUDENT);
    const join = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(join.status).toBe(201);

    asClerkUser(CLERK_MANAGER);
    const approve = await request(app).patch(
      `/v1/memberships/${join.body.id}/approve`,
    );
    expect(approve.status).toBe(200);

    const makePlan = async (name: string, weeklyCheckinLimit: number) => {
      const res = await request(app).post("/v1/subscriptions/plans").send({
        name,
        recurrenceMonths: 1,
        priceCents: 10_000,
        weeklyCheckinLimit,
      });
      expect(res.status).toBe(201);
      return res.body.id as string;
    };
    const adultPlanId = await makePlan("Basico", 2);
    const kidsPlanId = await makePlan("Kids", 2);

    const sessionDate = new Date().toISOString().slice(0, 10);
    const dow = new Date().getUTCDay();
    const makeClass = async (name: string) => {
      const res = await request(app).post("/v1/classes").send({
        instructorId: manager.id,
        name,
        dayOfWeek: dow,
        startTime: "00:00",
        endTime: "23:59",
        capacity: 30,
      });
      expect(res.status).toBe(201);
      return res.body.id as string;
    };
    const morningClassId = await makeClass("Manha");
    const eveningClassId = await makeClass("Tarde");

    asClerkUser(CLERK_STUDENT);
    const dep = await request(app).post("/v1/dependents").send({
      name: "Joao",
      birthDate: "2018-05-04",
      belt: "grey",
      stripes: 0,
    });
    expect(dep.status).toBe(201);
    const dependentId = dep.body.id as string;

    const ownEnroll = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId: adultPlanId });
    expect(ownEnroll.status).toBe(201);
    const ownSubscriptionId = ownEnroll.body.subscription.id as string;

    const depEnroll = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId: kidsPlanId, dependentId });
    expect(depEnroll.status).toBe(201);
    const depSubscriptionId = depEnroll.body.subscription.id as string;

    asClerkUser(CLERK_MANAGER);
    for (const subscriptionId of [ownSubscriptionId, depSubscriptionId]) {
      const pay = await request(app).post("/v1/payments").send({
        subscriptionId,
        amountCents: 10_000,
        referenceMonth: utcMonthFirstIso(),
      });
      expect(pay.status).toBe(201);
    }

    return {
      studentId: student.id,
      dependentId,
      morningClassId,
      eveningClassId,
      sessionDate,
    };
  }

  /** Takes both of the dependent's weekly sessions. */
  async function exhaustDependentWeeklyLimit(h: {
    studentId: string;
    dependentId: string;
    morningClassId: string;
    eveningClassId: string;
    sessionDate: string;
  }): Promise<void> {
    asClerkUser(CLERK_STUDENT);
    for (const classId of [h.morningClassId, h.eveningClassId]) {
      const res = await request(app).post("/v1/checkins").send({
        classId,
        date: h.sessionDate,
        dependentId: h.dependentId,
      });
      expect(res.status).toBe(201);
    }
  }

  it("a dependent's check-ins do not consume the account holder's weekly limit", async () => {
    const h = await seedHousehold();
    await exhaustDependentWeeklyLimit(h);

    asClerkUser(CLERK_STUDENT);
    const own = await request(app).post("/v1/checkins").send({
      classId: h.morningClassId,
      date: h.sessionDate,
    });

    expect(own.status).toBe(201);
    expect(own.body.checkin?.dependentId).toBeNull();
  });

  it("the account holder's check-ins do not consume the dependent's weekly limit", async () => {
    const h = await seedHousehold();

    asClerkUser(CLERK_STUDENT);
    for (const classId of [h.morningClassId, h.eveningClassId]) {
      const res = await request(app).post("/v1/checkins").send({
        classId,
        date: h.sessionDate,
      });
      expect(res.status).toBe(201);
    }

    const dep = await request(app).post("/v1/checkins").send({
      classId: h.morningClassId,
      date: h.sessionDate,
      dependentId: h.dependentId,
    });

    expect(dep.status).toBe(201);
    expect(dep.body.checkin?.dependentId).toBe(h.dependentId);
  });

  it("GET /checkins/me/weekly-count counts only the account holder's own check-ins", async () => {
    const h = await seedHousehold();
    await exhaustDependentWeeklyLimit(h);

    asClerkUser(CLERK_STUDENT);
    const mine = await request(app).get("/v1/checkins/me/weekly-count");
    expect(mine.status).toBe(200);
    expect(mine.body.count).toBe(0);

    const theirs = await request(app).get(
      `/v1/checkins/dependent/${h.dependentId}/weekly-count`,
    );
    expect(theirs.status).toBe(200);
    expect(theirs.body.count).toBe(2);
  });

  it("the account holder's history holds only their own check-ins", async () => {
    const h = await seedHousehold();
    await exhaustDependentWeeklyLimit(h);

    asClerkUser(CLERK_STUDENT);
    const own = await request(app).post("/v1/checkins").send({
      classId: h.morningClassId,
      date: h.sessionDate,
    });
    expect(own.status).toBe(201);

    const mine = await request(app).get("/v1/checkins/me/history?limit=10");
    expect(mine.status).toBe(200);
    const myWeeks = mine.body.items as Array<{
      count: number;
      checkins: Array<{ id: string }>;
    }>;
    expect(myWeeks).toHaveLength(1);
    expect(myWeeks[0]?.count).toBe(1);
    expect(myWeeks[0]?.checkins[0]?.id).toBe(own.body.checkin.id);

    const theirs = await request(app).get(
      `/v1/checkins/dependent/${h.dependentId}/history?limit=10`,
    );
    expect(theirs.status).toBe(200);
    const theirWeeks = theirs.body.items as Array<{ count: number }>;
    expect(theirWeeks).toHaveLength(1);
    expect(theirWeeks[0]?.count).toBe(2);
  });

  /**
   * Engagement counts only what the account holder trained. A parent is not
   * congratulated for their child's sessions, and taking a child to class is
   * not the parent having trained (decided on TAT-181).
   */
  describe("engagement", () => {
    it("countTotalByUser ignores the dependents' check-ins", async () => {
      const h = await seedHousehold();

      // The account holder trains first, so that this pins the engagement
      // count rather than tripping over the weekly-limit defect on its way.
      asClerkUser(CLERK_STUDENT);
      const own = await request(app).post("/v1/checkins").send({
        classId: h.morningClassId,
        date: h.sessionDate,
      });
      expect(own.status).toBe(201);

      await exhaustDependentWeeklyLimit(h);

      const repo = new PostgresCheckinRepository(ctx.db);
      expect(await repo.countTotalByUser(h.studentId)).toBe(1);
    });

    it("getWeeklyCheckinSummaries ignores the dependents' check-ins", async () => {
      const h = await seedHousehold();

      asClerkUser(CLERK_STUDENT);
      const own = await request(app).post("/v1/checkins").send({
        classId: h.eveningClassId,
        date: h.sessionDate,
      });
      expect(own.status).toBe(201);

      await exhaustDependentWeeklyLimit(h);

      const repo = new PostgresCheckinRepository(ctx.db);
      const summaries = await repo.getWeeklyCheckinSummaries(
        mondayOfWeekContaining(h.sessionDate),
      );

      expect(summaries).toEqual([{ userId: h.studentId, count: 1 }]);
    });

    it("findInactiveUserIds does not treat a dependent's session as the guardian training", async () => {
      const h = await seedHousehold();
      await exhaustDependentWeeklyLimit(h);

      // The account holder last trained well before the 14-day cutoff; only
      // their dependent has been to class since.
      const stale = "2026-01-05";
      await ctx.db.insert(checkins).values({
        classId: h.morningClassId,
        userId: h.studentId,
        date: stale,
        weekReference: mondayOfWeekContaining(stale),
        dependentId: null,
      });

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 14);

      const repo = new PostgresCheckinRepository(ctx.db);
      const inactive = await repo.findInactiveUserIds(
        cutoff.toISOString().slice(0, 10),
      );

      expect(inactive).toContain(h.studentId);
    });
  });
});
