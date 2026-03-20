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
});
