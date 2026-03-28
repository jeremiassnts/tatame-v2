import {
  asClerkUser,
  resetIntegrationClerkAuth,
} from "./testing/integration-clerk-mock.js";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setDbForTest } from "./lib/db.js";
import { insertUserWithGlobalRole } from "./testing/integration-seed.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

const CLERK_MANAGER = "user_integration_sub_mgr";
const CLERK_STUDENT = "user_integration_sub_std";

function utcMonthFirstIso(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

describe("Subscription & payment integration", () => {
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

  it("manager creates plan; student enrolls; manager records manual payment", async () => {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Payment Dojo" });
    expect(ac.status).toBe(201);
    const academyId = ac.body.id as string;

    asClerkUser(CLERK_STUDENT);
    const reqJoin = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(reqJoin.status).toBe(201);

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${reqJoin.body.id}/approve`);

    const planRes = await request(app).post("/v1/subscriptions/plans").send({
      name: "Monthly",
      recurrenceMonths: 1,
      priceCents: 12_000,
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
    const pay = await request(app).post("/v1/payments").send({
      subscriptionId,
      amountCents: 12_000,
      referenceMonth: utcMonthFirstIso(),
    });
    expect(pay.status).toBe(201);

    const listed = await request(app).get("/v1/payments");
    expect(listed.status).toBe(200);
    expect(listed.body.items?.length).toBe(1);
  });

  it("manager lists academy subscriptions and views detail", async () => {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Sub Dojo" });
    expect(ac.status).toBe(201);
    const academyId = ac.body.id as string;

    asClerkUser(CLERK_STUDENT);
    const join = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(join.status).toBe(201);

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${join.body.id}/approve`);

    const plan = await request(app).post("/v1/subscriptions/plans").send({
      name: "Monthly",
      recurrenceMonths: 1,
      priceCents: 15_000,
      weeklyCheckinLimit: null,
    });
    expect(plan.status).toBe(201);

    asClerkUser(CLERK_STUDENT);
    const enroll = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId: plan.body.id });
    expect(enroll.status).toBe(201);
    const subscriptionId = enroll.body.subscription.id as string;

    asClerkUser(CLERK_MANAGER);

    const list = await request(app).get("/v1/subscriptions/academy");
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBe(1);
    expect(list.body.items[0].user.name).toBeTruthy();
    expect(list.body.items[0].plan.name).toBe("Monthly");
    expect(list.body.items[0].effectiveStatus).toBe("active");
    expect(list.body.items[0].hasPaidCurrentMonth).toBe(false);

    const detail = await request(app).get(
      `/v1/subscriptions/academy/${subscriptionId}`,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.subscription.id).toBe(subscriptionId);
    expect(detail.body.user.name).toBeTruthy();

    const pending = await request(app).get(
      "/v1/subscriptions/academy?pendingPayment=true",
    );
    expect(pending.status).toBe(200);
    expect(pending.body.items.length).toBe(1);
  });

  it("manager gets financial summary", async () => {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Finance Dojo" });
    expect(ac.status).toBe(201);

    asClerkUser(CLERK_STUDENT);
    const join = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId: ac.body.id });
    expect(join.status).toBe(201);

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${join.body.id}/approve`);

    const plan = await request(app).post("/v1/subscriptions/plans").send({
      name: "Basic",
      recurrenceMonths: 1,
      priceCents: 10_000,
      weeklyCheckinLimit: null,
    });

    asClerkUser(CLERK_STUDENT);
    const enroll = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId: plan.body.id });

    asClerkUser(CLERK_MANAGER);
    await request(app).post("/v1/payments").send({
      subscriptionId: enroll.body.subscription.id,
      amountCents: 10_000,
      referenceMonth: utcMonthFirstIso(),
    });

    const summary = await request(app).get("/v1/finances/summary");
    expect(summary.status).toBe(200);
    expect(summary.body.revenueCurrentMonth).toBe(10_000);
    expect(summary.body.activeSubscriptionsCount).toBe(1);
    expect(summary.body.pendingPaymentsCount).toBe(0);
  });

  it("payments list supports limit param", async () => {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Limit Dojo" });

    asClerkUser(CLERK_STUDENT);
    const join = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId: ac.body.id });

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${join.body.id}/approve`);

    const plan = await request(app).post("/v1/subscriptions/plans").send({
      name: "Limit Plan",
      recurrenceMonths: 1,
      priceCents: 5_000,
      weeklyCheckinLimit: null,
    });

    asClerkUser(CLERK_STUDENT);
    const enroll = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId: plan.body.id });

    asClerkUser(CLERK_MANAGER);
    await request(app).post("/v1/payments").send({
      subscriptionId: enroll.body.subscription.id,
      amountCents: 5_000,
      referenceMonth: utcMonthFirstIso(),
    });
    await request(app).post("/v1/payments").send({
      subscriptionId: enroll.body.subscription.id,
      amountCents: 5_000,
      referenceMonth: "2026-02-01",
    });

    const limited = await request(app).get("/v1/payments?limit=1");
    expect(limited.status).toBe(200);
    expect(limited.body.items.length).toBe(1);

    const all = await request(app).get("/v1/payments");
    expect(all.status).toBe(200);
    expect(all.body.items.length).toBe(2);
  });
});
