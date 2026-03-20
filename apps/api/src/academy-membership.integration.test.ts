import {
  asClerkUser,
  resetIntegrationClerkAuth,
} from "./testing/integration-clerk-mock.js";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setDbForTest } from "./lib/db.js";
import { insertUserWithGlobalRole } from "./testing/integration-seed.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

const CLERK_MANAGER = "user_integration_academy_mgr";
const CLERK_STUDENT = "user_integration_academy_std";

describe("Academy & membership integration", () => {
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

  it("manager creates academy; student requests and is approved", async () => {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const created = await request(app)
      .post("/v1/academies")
      .send({ name: "Integration Dojo" });
    expect(created.status).toBe(201);
    const academyId = created.body.id as string;

    const listed = await request(app).get("/v1/academies").query({ q: "Integr" });
    expect(listed.status).toBe(200);
    expect(listed.body.items?.length).toBeGreaterThanOrEqual(1);

    asClerkUser(CLERK_STUDENT);
    const reqJoin = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(reqJoin.status).toBe(201);
    const membershipId = reqJoin.body.id as string;

    asClerkUser(CLERK_MANAGER);
    const pending = await request(app)
      .get("/v1/memberships/pending")
      .query({ academyId });
    expect(pending.status).toBe(200);
    expect(pending.body.items?.map((x: { id: string }) => x.id)).toContain(
      membershipId,
    );

    const approved = await request(app).patch(
      `/v1/memberships/${membershipId}/approve`,
    );
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("active");
  });
});
