import { Belt } from "@tatame/types";
import {
  asClerkUser,
  resetIntegrationClerkAuth,
} from "./testing/integration-clerk-mock.js";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setDbForTest } from "./lib/db.js";
import { insertFreeSubscription, insertUserWithGlobalRole } from "./testing/integration-seed.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

const CLERK_MANAGER = "user_integration_grad_mgr";
const CLERK_STUDENT = "user_integration_grad_std";

describe("Graduation routes integration", () => {
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

  it("student registers initial belt; manager promotes", async () => {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    const student = await insertUserWithGlobalRole(
      ctx.db,
      CLERK_STUDENT,
      "student",
    );

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Belt Dojo" });
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

    asClerkUser(CLERK_STUDENT);
    const initial = await request(app).post("/v1/graduations/initial").send({
      belt: Belt.White,
      stripes: 0,
    });
    expect(initial.status).toBe(201);
    expect(initial.body.belt).toBe(Belt.White);

    asClerkUser(CLERK_MANAGER);
    const promote = await request(app).post("/v1/graduations").send({
      userId: student.id,
      belt: Belt.Blue,
      stripes: 0,
    });
    expect(promote.status).toBe(201);
    expect(promote.body.belt).toBe(Belt.Blue);

    const history = await request(app)
      .get("/v1/graduations")
      .query({ userId: student.id });
    expect(history.status).toBe(200);
    expect(history.body.items?.length).toBeGreaterThanOrEqual(2);
  });

  it("academy owner registers initial belt while in manager role", async () => {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Owner Belt Only" });
    expect(ac.status).toBe(201);

    const initial = await request(app).post("/v1/graduations/initial").send({
      belt: Belt.White,
      stripes: 0,
    });
    expect(initial.status).toBe(201);
    expect(initial.body.belt).toBe(Belt.White);

    const mine = await request(app).get("/v1/graduations/me");
    expect(mine.status).toBe(200);
    const current = mine.body.items?.find((g: { isCurrent: boolean }) => g.isCurrent);
    expect(current?.belt).toBe(Belt.White);
  });
});
