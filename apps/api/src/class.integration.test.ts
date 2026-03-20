import {
  asClerkUser,
  resetIntegrationClerkAuth,
} from "./testing/integration-clerk-mock.js";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setDbForTest } from "./lib/db.js";
import { insertUserWithGlobalRole } from "./testing/integration-seed.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

const CLERK_MANAGER = "user_integration_class_mgr";
const CLERK_STUDENT = "user_integration_class_std";

describe("Class routes integration", () => {
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

  it("manager creates class and lists it", async () => {
    const manager = await insertUserWithGlobalRole(
      ctx.db,
      CLERK_MANAGER,
      "manager",
    );
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Class Flow Dojo" });
    expect(ac.status).toBe(201);
    const academyId = ac.body.id as string;

    asClerkUser(CLERK_STUDENT);
    const reqJoin = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(reqJoin.status).toBe(201);

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${reqJoin.body.id}/approve`);

    const dow = new Date().getUTCDay();
    const created = await request(app).post("/v1/classes").send({
      instructorId: manager.id,
      name: "Morning Gi",
      dayOfWeek: dow,
      startTime: "09:00",
      endTime: "10:30",
      capacity: 12,
    });
    expect(created.status).toBe(201);

    const list = await request(app).get("/v1/classes");
    expect(list.status).toBe(200);
    expect(list.body.items?.length).toBe(1);
    expect(list.body.items[0].name).toBe("Morning Gi");
  });
});
