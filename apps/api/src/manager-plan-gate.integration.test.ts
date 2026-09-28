import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  asClerkUser,
  resetIntegrationClerkAuth,
} from "./testing/integration-clerk-mock.js";
import { setDbForTest } from "./lib/db.js";
import {
  insertSubscription,
  insertUserWithGlobalRole,
} from "./testing/integration-seed.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

const CLERK_MANAGER = "user_integration_plan_gate_mgr";

/**
 * A manager whose card was declined used to reach the full manager panel: the
 * mobile app auto-called `POST /manager-subscriptions/free` on a 404 from
 * `/me`, and `requireActivePlan` let `incomplete` through. Both doors are
 * closed here, and both are cheap to reopen by accident.
 */
describe("Manager plan gate integration", () => {
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

  async function createAcademyAsManager(): Promise<string> {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    asClerkUser(CLERK_MANAGER);
    const res = await request(app)
      .post("/v1/academies")
      .send({ name: "Plan Gate Dojo" });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  it("no longer exposes an endpoint that self-grants a plan", async () => {
    await createAcademyAsManager();

    const res = await request(app).post("/v1/manager-subscriptions/free");

    expect(res.status).toBe(404);
  });

  it("reports no subscription so the app can send the manager to checkout", async () => {
    await createAcademyAsManager();

    const res = await request(app).get("/v1/manager-subscriptions/me");

    expect(res.status).toBe(404);
  });

  it("rejects a gated write when the subscription is incomplete", async () => {
    const academyId = await createAcademyAsManager();
    await insertSubscription(ctx.db, academyId, { status: "incomplete" });

    const res = await request(app).post("/v1/classes").send({
      name: "Morning Gi",
      dayOfWeek: new Date().getUTCDay(),
      startTime: "09:00",
      endTime: "10:30",
      capacity: 12,
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("SUBSCRIPTION_BLOCKED");
  });

  it("still lets a trialing subscription write", async () => {
    const academyId = await createAcademyAsManager();
    await insertSubscription(ctx.db, academyId, { status: "trialing" });

    const res = await request(app).post("/v1/classes").send({
      name: "Morning Gi",
      dayOfWeek: new Date().getUTCDay(),
      startTime: "09:00",
      endTime: "10:30",
      capacity: 12,
    });

    expect(res.status).not.toBe(403);
  });
});
