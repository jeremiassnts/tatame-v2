import { vi } from "vitest";
import {
  asClerkUser,
  resetIntegrationClerkAuth,
} from "./testing/integration-clerk-mock.js";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setDbForTest } from "./lib/db.js";
import { insertFreeSubscription, insertUserWithGlobalRole } from "./testing/integration-seed.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

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

const CLERK_MANAGER = "user_integration_ck_mgr";
const CLERK_STUDENT = "user_integration_ck_std";

function utcMonthFirstIso(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

describe("Check-in integration", () => {
  let app: import("express").Express;
  let ctx: Awaited<ReturnType<typeof setupIntegrationTest>>;

  beforeAll(async () => {
    ctx = await setupIntegrationTest();
    setDbForTest(ctx.db);
    const { createApp } = await import("./app.js");
    app = createApp();
  });

  afterEach(async () => {
    resetIntegrationClerkAuth();
    await ctx.truncateAll();
  });

  afterAll(async () => {
    await ctx.dropSchema();
  });

  it("student checks in during open window with active subscription and payment", async () => {
    const manager = await insertUserWithGlobalRole(
      ctx.db,
      CLERK_MANAGER,
      "manager",
    );
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Checkin Dojo" });
    expect(ac.status).toBe(201);
    const academyId = ac.body.id as string;
    await insertFreeSubscription(ctx.db, academyId);

    asClerkUser(CLERK_STUDENT);
    const reqJoin = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(reqJoin.status).toBe(201);

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${reqJoin.body.id}/approve`);

    const planRes = await request(app).post("/v1/subscriptions/plans").send({
      name: "Open mat",
      recurrenceMonths: 1,
      priceCents: 8000,
      weeklyCheckinLimit: null,
    });
    expect(planRes.status).toBe(201);
    const planId = planRes.body.id as string;

    asClerkUser(CLERK_STUDENT);
    const enroll = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId });
    expect(enroll.status).toBe(201);
    const subscriptionId = enroll.body.subscription.id as string;

    asClerkUser(CLERK_MANAGER);
    await request(app).post("/v1/payments").send({
      subscriptionId,
      amountCents: 8000,
      referenceMonth: utcMonthFirstIso(),
    });

    const sessionDate = new Date().toISOString().slice(0, 10);
    const dow = new Date().getUTCDay();
    const cls = await request(app).post("/v1/classes").send({
      instructorId: manager.id,
      name: "All day open mat",
      dayOfWeek: dow,
      startTime: "00:00",
      endTime: "23:59",
      capacity: 30,
    });
    expect(cls.status).toBe(201);
    const classId = cls.body.id as string;

    asClerkUser(CLERK_STUDENT);
    const ck = await request(app).post("/v1/checkins").send({
      classId,
      date: sessionDate,
    });
    expect(ck.status).toBe(201);
    expect(ck.body.checkin?.classId).toBe(classId);
  });

  /**
   * Helper that sets up a full academy with a student who has a valid
   * subscription, payment, class, and one completed check-in.
   * Returns the ids needed by follow-up assertions.
   */
  async function seedCheckin() {
    const manager = await insertUserWithGlobalRole(
      ctx.db,
      CLERK_MANAGER,
      "manager",
    );
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Checkin Dojo" });
    const academyId = ac.body.id as string;
    await insertFreeSubscription(ctx.db, academyId);

    asClerkUser(CLERK_STUDENT);
    const reqJoin = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${reqJoin.body.id}/approve`);

    const planRes = await request(app).post("/v1/subscriptions/plans").send({
      name: "Open mat",
      recurrenceMonths: 1,
      priceCents: 8000,
      weeklyCheckinLimit: null,
    });
    const planId = planRes.body.id as string;

    asClerkUser(CLERK_STUDENT);
    const enroll = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId });
    const subscriptionId = enroll.body.subscription.id as string;

    asClerkUser(CLERK_MANAGER);
    await request(app).post("/v1/payments").send({
      subscriptionId,
      amountCents: 8000,
      referenceMonth: utcMonthFirstIso(),
    });

    const sessionDate = new Date().toISOString().slice(0, 10);
    const dow = new Date().getUTCDay();
    const cls = await request(app).post("/v1/classes").send({
      instructorId: manager.id,
      name: "All day open mat",
      dayOfWeek: dow,
      startTime: "00:00",
      endTime: "23:59",
      capacity: 30,
    });
    const classId = cls.body.id as string;

    asClerkUser(CLERK_STUDENT);
    const ck = await request(app).post("/v1/checkins").send({
      classId,
      date: sessionDate,
    });
    expect(ck.status).toBe(201);

    return { academyId, classId, sessionDate };
  }

  it("GET /v1/checkins/me/weekly-count returns count after a check-in", async () => {
    await seedCheckin();

    asClerkUser(CLERK_STUDENT);
    const res = await request(app).get("/v1/checkins/me/weekly-count");

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.weekReference).toBeDefined();
  });

  it("GET /v1/checkins/me/history returns paginated history after a check-in", async () => {
    const { classId } = await seedCheckin();

    asClerkUser(CLERK_STUDENT);
    const res = await request(app).get("/v1/checkins/me/history?limit=10");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);

    const week = res.body.items[0];
    expect(week.count).toBe(1);
    expect(week.weekReference).toBeDefined();
    expect(Array.isArray(week.checkins)).toBe(true);
    expect(week.checkins.length).toBe(1);
    expect(week.checkins[0].className).toBe("All day open mat");
  });

  it("GET /v1/checkins/me/weekly-count returns zero when no check-ins exist", async () => {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Empty Dojo" });
    const academyId = ac.body.id as string;
    await insertFreeSubscription(ctx.db, academyId);

    asClerkUser(CLERK_STUDENT);
    const reqJoin = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${reqJoin.body.id}/approve`);

    asClerkUser(CLERK_STUDENT);
    const res = await request(app).get("/v1/checkins/me/weekly-count");

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });
});
