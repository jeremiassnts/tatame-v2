import {
  asClerkUser,
  resetIntegrationClerkAuth,
} from "./testing/integration-clerk-mock.js";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setDbForTest } from "./lib/db.js";
import { insertFreeSubscription, insertUserWithGlobalRole } from "./testing/integration-seed.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

const CLERK_MANAGER = "user_integration_academy_mgr";
const CLERK_STUDENT = "user_integration_academy_std";
const CLERK_STUDENT_2 = "user_integration_academy_std2";

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
    await insertFreeSubscription(ctx.db, academyId);

    const stats = await request(app).get(`/v1/academies/${academyId}/stats`);
    expect(stats.status).toBe(200);
    expect(stats.body).toMatchObject({
      activeMembers: 1,
      pendingRequests: 0,
      activePlans: 0,
    });
    expect(typeof stats.body.classesToday).toBe("number");

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

  it("manager rejects a pending membership", async () => {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const created = await request(app)
      .post("/v1/academies")
      .send({ name: "Reject Dojo" });
    expect(created.status).toBe(201);
    const academyId = created.body.id as string;
    await insertFreeSubscription(ctx.db, academyId);

    asClerkUser(CLERK_STUDENT);
    const reqJoin = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(reqJoin.status).toBe(201);
    const membershipId = reqJoin.body.id as string;

    asClerkUser(CLERK_MANAGER);
    const rejected = await request(app).patch(
      `/v1/memberships/${membershipId}/reject`,
    );
    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe("rejected");
  });

  it("manager blocks an active member", async () => {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const created = await request(app)
      .post("/v1/academies")
      .send({ name: "Block Dojo" });
    expect(created.status).toBe(201);
    const academyId = created.body.id as string;
    await insertFreeSubscription(ctx.db, academyId);

    asClerkUser(CLERK_STUDENT);
    const reqJoin = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(reqJoin.status).toBe(201);
    const membershipId = reqJoin.body.id as string;

    asClerkUser(CLERK_MANAGER);
    const approved = await request(app).patch(
      `/v1/memberships/${membershipId}/approve`,
    );
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("active");

    const blocked = await request(app).patch(
      `/v1/memberships/${membershipId}/block`,
    );
    expect(blocked.status).toBe(200);
    expect(blocked.body.status).toBe("blocked");
  });

  it("manager unblocks a blocked member", async () => {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const created = await request(app)
      .post("/v1/academies")
      .send({ name: "Unblock Dojo" });
    expect(created.status).toBe(201);
    const academyId = created.body.id as string;
    await insertFreeSubscription(ctx.db, academyId);

    asClerkUser(CLERK_STUDENT);
    const reqJoin = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(reqJoin.status).toBe(201);
    const membershipId = reqJoin.body.id as string;

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${membershipId}/approve`);
    await request(app).patch(`/v1/memberships/${membershipId}/block`);

    const unblocked = await request(app).patch(
      `/v1/memberships/${membershipId}/unblock`,
    );
    expect(unblocked.status).toBe(204);
  });

  it("student leaves academy", async () => {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const created = await request(app)
      .post("/v1/academies")
      .send({ name: "Leave Dojo" });
    expect(created.status).toBe(201);
    const academyId = created.body.id as string;
    await insertFreeSubscription(ctx.db, academyId);

    asClerkUser(CLERK_STUDENT);
    const reqJoin = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(reqJoin.status).toBe(201);
    const membershipId = reqJoin.body.id as string;

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${membershipId}/approve`);

    asClerkUser(CLERK_STUDENT);
    const left = await request(app).post("/v1/memberships/leave");
    expect(left.status).toBe(200);
  });

  it("manager lists members with filters", async () => {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT_2, "student");

    asClerkUser(CLERK_MANAGER);
    const created = await request(app)
      .post("/v1/academies")
      .send({ name: "Filter Dojo" });
    expect(created.status).toBe(201);
    const academyId = created.body.id as string;
    await insertFreeSubscription(ctx.db, academyId);

    asClerkUser(CLERK_STUDENT);
    const req1 = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(req1.status).toBe(201);
    const membership1Id = req1.body.id as string;

    asClerkUser(CLERK_STUDENT_2);
    const req2 = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(req2.status).toBe(201);
    const membership2Id = req2.body.id as string;

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${membership1Id}/approve`);
    await request(app).patch(`/v1/memberships/${membership2Id}/approve`);

    const allMembers = await request(app)
      .get("/v1/memberships")
      .query({ academyId });
    expect(allMembers.status).toBe(200);
    expect(allMembers.body.length).toBeGreaterThanOrEqual(3);

    const studentOnly = await request(app)
      .get("/v1/memberships")
      .query({ academyId, role: "student" });
    expect(studentOnly.status).toBe(200);
    expect(studentOnly.body.length).toBe(2);
  });

  it("manager views member detail", async () => {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const created = await request(app)
      .post("/v1/academies")
      .send({ name: "Detail Dojo" });
    expect(created.status).toBe(201);
    const academyId = created.body.id as string;
    await insertFreeSubscription(ctx.db, academyId);

    asClerkUser(CLERK_STUDENT);
    const reqJoin = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(reqJoin.status).toBe(201);
    const membershipId = reqJoin.body.id as string;

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${membershipId}/approve`);

    const detail = await request(app).get(
      `/v1/memberships/${membershipId}`,
    );
    expect(detail.status).toBe(200);
    expect(detail.body).toHaveProperty("userId");
    expect(detail.body).toHaveProperty("status");
    expect(detail.body).toHaveProperty("history");
  });
});
