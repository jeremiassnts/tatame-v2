import {
  asAnonymous,
  asClerkUser,
  resetIntegrationClerkAuth,
} from "./testing/integration-clerk-mock.js";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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

  beforeEach(async () => {
    await ctx.truncateAll();
    resetIntegrationClerkAuth();
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

  /**
   * The invite page at `/convite/<academyId>` has no logged-in user, so it reads
   * this route and nothing else. What it is allowed to see is the whole point:
   * `GET /v1/academies/:academyId` returns the full row, `pixKey` included.
   */
  describe("public academy projection", () => {
    async function seedAcademy(name: string, logoUrl: string | null) {
      await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
      asClerkUser(CLERK_MANAGER);
      const created = await request(app)
        .post("/v1/academies")
        .send({ name, ...(logoUrl ? { logoUrl } : {}) });
      expect(created.status).toBe(201);
      return created.body.id as string;
    }

    it("serves an academy's name and logo with no session", async () => {
      const academyId = await seedAcademy(
        "Academia do Convite",
        "https://cdn.example/logo-convite.png",
      );

      asAnonymous();
      const res = await request(app).get(`/v1/academies/${academyId}/public`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Academia do Convite");
      expect(res.body.logoUrl).toBe("https://cdn.example/logo-convite.png");
      expect(res.body.id).toBe(academyId);
    });

    it("exposes nothing beyond id, name and logoUrl", async () => {
      const academyId = await seedAcademy("Academia Fechada", null);
      // Populate the contact fields so the row genuinely carries something the
      // public projection must not hand out.
      const patched = await request(app)
        .patch(`/v1/academies/${academyId}`)
        .send({
          contactEmail: "contato@example.com",
          contactPhone: "+5511999999999",
          address: "Rua Um, 100",
        });
      expect(patched.status).toBe(200);

      asAnonymous();
      const res = await request(app).get(`/v1/academies/${academyId}/public`);

      expect(res.status).toBe(200);
      // Array equality, not a set of `not.toHaveProperty` assertions: a key
      // added later fails this too, which is what a leak looks like.
      expect(Object.keys(res.body).sort()).toEqual(["id", "logoUrl", "name"]);
    });

    it("refuses an academy id that is not a uuid", async () => {
      asAnonymous();
      const res = await request(app).get("/v1/academies/not-a-uuid/public");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid academy id");
    });

    it("answers not found for an academy id nobody owns", async () => {
      asAnonymous();
      const res = await request(app).get(
        `/v1/academies/${randomUUID()}/public`,
      );

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Academy not found");
    });

    it("opens only the public projection to an anonymous caller", async () => {
      const academyId = await seedAcademy("Academia Guardada", null);

      asAnonymous();
      const publicRes = await request(app).get(
        `/v1/academies/${academyId}/public`,
      );
      // The live sibling on the same router, in the same test: a 404 on the
      // public route could mean "route gone" or "router unmounted", and only a
      // neighbour still answering tells those apart.
      const guardedRes = await request(app).get(`/v1/academies/${academyId}`);

      expect(publicRes.status).toBe(200);
      expect(guardedRes.status).toBe(401);
    });
  });
});
