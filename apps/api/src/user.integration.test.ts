import {
  INTEGRATION_CLERK_USER_ID,
  resetIntegrationClerkAuth,
} from "./testing/integration-clerk-mock.js";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setDbForTest } from "./lib/db.js";
import { insertUserWithoutRole } from "./testing/integration-seed.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

describe("User routes integration", () => {
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

  it("POST /v1/users/me/role then GET /v1/users/me returns activeRole", async () => {
    await insertUserWithoutRole(ctx.db, INTEGRATION_CLERK_USER_ID);

    const postRole = await request(app)
      .post("/v1/users/me/role")
      .send({ role: "student" });
    expect(postRole.status).toBe(201);

    const me = await request(app).get("/v1/users/me");
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      activeRole: "student",
      clerkUserId: INTEGRATION_CLERK_USER_ID,
      activeAcademy: null,
    });
  });
});
