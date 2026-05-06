import {
  asClerkUser,
  resetIntegrationClerkAuth,
} from "./testing/integration-clerk-mock.js";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setDbForTest } from "./lib/db.js";
import { insertFreeSubscription, insertUserWithGlobalRole } from "./testing/integration-seed.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

const CLERK_MANAGER = "user_integration_class_mgr";
const CLERK_STUDENT = "user_integration_class_std";
const CLERK_INSTRUCTOR = "user_integration_class_inst";

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
    await insertFreeSubscription(ctx.db, academyId);

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

  it("instructor creates class for themselves", async () => {
    const manager = await insertUserWithGlobalRole(
      ctx.db,
      CLERK_MANAGER,
      "manager",
    );
    const instructor = await insertUserWithGlobalRole(
      ctx.db,
      CLERK_INSTRUCTOR,
      "instructor",
    );

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Instructor Dojo" });
    expect(ac.status).toBe(201);
    const academyId = ac.body.id as string;
    await insertFreeSubscription(ctx.db, academyId);

    asClerkUser(CLERK_INSTRUCTOR);
    const reqJoin = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(reqJoin.status).toBe(201);

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${reqJoin.body.id}/approve`);

    asClerkUser(CLERK_INSTRUCTOR);
    const dow = new Date().getUTCDay();
    const created = await request(app).post("/v1/classes").send({
      instructorId: instructor.id,
      name: "Instructor Class",
      dayOfWeek: dow,
      startTime: "08:00",
      endTime: "09:30",
      capacity: 10,
    });
    expect(created.status).toBe(201);
  });

  it("manager updates a class", async () => {
    const manager = await insertUserWithGlobalRole(
      ctx.db,
      CLERK_MANAGER,
      "manager",
    );

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Update Dojo" });
    expect(ac.status).toBe(201);
    const academyId = ac.body.id as string;
    await insertFreeSubscription(ctx.db, academyId);

    const dow = new Date().getUTCDay();
    const created = await request(app).post("/v1/classes").send({
      instructorId: manager.id,
      name: "Original Class",
      dayOfWeek: dow,
      startTime: "10:00",
      endTime: "11:30",
      capacity: 15,
    });
    expect(created.status).toBe(201);
    const classId = created.body.id as string;

    const updated = await request(app)
      .patch(`/v1/classes/${classId}`)
      .send({ name: "Updated Class" });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe("Updated Class");
  });

  it("manager deactivates a class", async () => {
    const manager = await insertUserWithGlobalRole(
      ctx.db,
      CLERK_MANAGER,
      "manager",
    );

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Deactivate Dojo" });
    expect(ac.status).toBe(201);
    const academyId = ac.body.id as string;
    await insertFreeSubscription(ctx.db, academyId);

    const dow = new Date().getUTCDay();
    const created = await request(app).post("/v1/classes").send({
      instructorId: manager.id,
      name: "Soon Inactive",
      dayOfWeek: dow,
      startTime: "14:00",
      endTime: "15:30",
      capacity: 20,
    });
    expect(created.status).toBe(201);
    const classId = created.body.id as string;

    const deactivated = await request(app).delete(
      `/v1/classes/${classId}`,
    );
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.isActive).toBe(false);
  });

  it("student gets class by id", async () => {
    const manager = await insertUserWithGlobalRole(
      ctx.db,
      CLERK_MANAGER,
      "manager",
    );
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "GetById Dojo" });
    expect(ac.status).toBe(201);
    const academyId = ac.body.id as string;
    await insertFreeSubscription(ctx.db, academyId);

    const dow = new Date().getUTCDay();
    const created = await request(app).post("/v1/classes").send({
      instructorId: manager.id,
      name: "Visible Class",
      dayOfWeek: dow,
      startTime: "16:00",
      endTime: "17:30",
      capacity: 10,
    });
    expect(created.status).toBe(201);
    const classId = created.body.id as string;

    asClerkUser(CLERK_STUDENT);
    const reqJoin = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(reqJoin.status).toBe(201);

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${reqJoin.body.id}/approve`);

    asClerkUser(CLERK_STUDENT);
    const fetched = await request(app).get(`/v1/classes/${classId}`);
    expect(fetched.status).toBe(200);
  });

  it("student cannot see inactive class", async () => {
    const manager = await insertUserWithGlobalRole(
      ctx.db,
      CLERK_MANAGER,
      "manager",
    );
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Inactive Dojo" });
    expect(ac.status).toBe(201);
    const academyId = ac.body.id as string;
    await insertFreeSubscription(ctx.db, academyId);

    const dow = new Date().getUTCDay();
    const created = await request(app).post("/v1/classes").send({
      instructorId: manager.id,
      name: "Hidden Class",
      dayOfWeek: dow,
      startTime: "18:00",
      endTime: "19:30",
      capacity: 10,
    });
    expect(created.status).toBe(201);
    const classId = created.body.id as string;

    await request(app).delete(`/v1/classes/${classId}`);

    asClerkUser(CLERK_STUDENT);
    const reqJoin = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(reqJoin.status).toBe(201);

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${reqJoin.body.id}/approve`);

    asClerkUser(CLERK_STUDENT);
    const fetched = await request(app).get(`/v1/classes/${classId}`);
    expect(fetched.status).toBe(404);
  });
});
