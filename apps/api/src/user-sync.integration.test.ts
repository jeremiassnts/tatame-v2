import {
  INTEGRATION_CLERK_USER_ID,
  resetIntegrationClerkAuth,
} from "./testing/integration-clerk-mock.js";
import request from "supertest";
import { eq } from "drizzle-orm";
import { users } from "@tatame/db/schema";
import {
  afterAll,
  beforeEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { setDbForTest } from "./lib/db.js";
import { insertUserWithGlobalRole } from "./testing/integration-seed.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

vi.mock("./lib/clerk.js", () => ({
  getClerkClient: () => ({
    users: {
      getUser: vi.fn(async (clerkUserId: string) => ({
        id: clerkUserId,
        emailAddresses: [{ id: "ea_1", emailAddress: "sync@example.com" }],
        primaryEmailAddressId: "ea_1",
        firstName: "Sync",
        lastName: "User",
        imageUrl: "https://img.example.com/sync.jpg",
        username: null as string | null,
      })),
      deleteUser: vi.fn(async () => ({})),
    },
  }),
}));

describe("User sync integration", () => {
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

  it("POST /v1/users/me/sync creates user and returns UserMeResponse", async () => {
    const res = await request(app).post("/v1/users/me/sync").send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      clerkUserId: INTEGRATION_CLERK_USER_ID,
      email: "sync@example.com",
      name: "Sync User",
      profileImageUrl: "https://img.example.com/sync.jpg",
      activeRole: null,
      activeAcademy: null,
    });
    expect(res.body.id).toBeDefined();
  });

  it("POST /v1/users/me/sync with role assigns role to new user", async () => {
    const res = await request(app)
      .post("/v1/users/me/sync")
      .send({ role: "manager" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      activeRole: "manager",
    });
  });

  it("POST /v1/users/me/sync is idempotent — second call updates user", async () => {
    await request(app).post("/v1/users/me/sync").send({});
    const res = await request(app).post("/v1/users/me/sync").send({});

    expect(res.status).toBe(200);

    const rows = await ctx.db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, INTEGRATION_CLERK_USER_ID));
    expect(rows).toHaveLength(1);
  });

  it("POST /v1/users/me/sync with role ignores role if already assigned", async () => {
    await insertUserWithGlobalRole(ctx.db, INTEGRATION_CLERK_USER_ID, "student");

    const res = await request(app)
      .post("/v1/users/me/sync")
      .send({ role: "manager" });

    expect(res.status).toBe(200);
    expect(res.body.activeRole).toBe("student");
  });

  it("POST /v1/users/me/sync with invalid role returns 400", async () => {
    const res = await request(app)
      .post("/v1/users/me/sync")
      .send({ role: "admin" });

    expect(res.status).toBe(400);
  });

  it("GET /v1/users/me returns 404 with updated message when user not synced", async () => {
    const res = await request(app).get("/v1/users/me");

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("faça login novamente");
  });

  it("POST /v1/users/me/sync then GET /v1/users/me returns full profile", async () => {
    await request(app)
      .post("/v1/users/me/sync")
      .send({ role: "student" });

    const me = await request(app).get("/v1/users/me");
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      clerkUserId: INTEGRATION_CLERK_USER_ID,
      activeRole: "student",
      activeAcademy: null,
    });
  });

  /**
   * What the Pix screen renders its CPF field from. Asaas refuses to charge a
   * customer with no document and the platform stores none (D7), so the student
   * types it — but only ever on the first charge, because `ensureCustomer`
   * returns early once `asaas_customer_id` is set and ignores the value sent.
   *
   * The flag exists so the screen can ask up front instead of asking always
   * (monthly friction for a value the API throws away) or asking only after a
   * `CPF_REQUIRED` 400 (an error on the normal path). Only ever a boolean —
   * the document itself is never stored and never served.
   */
  it("GET /v1/users/me asks for a document from a student with no Asaas customer", async () => {
    await request(app).post("/v1/users/me/sync").send({ role: "student" });

    const me = await request(app).get("/v1/users/me");

    expect(me.status).toBe(200);
    expect(me.body.documentRequired).toBe(true);
  });

  it("GET /v1/users/me stops asking once the student has an Asaas customer", async () => {
    await request(app).post("/v1/users/me/sync").send({ role: "student" });
    const before = await request(app).get("/v1/users/me");

    await ctx.db
      .update(users)
      .set({ asaasCustomerId: "cus_000009262465" })
      .where(eq(users.id, before.body.id));

    const me = await request(app).get("/v1/users/me");
    expect(me.body.documentRequired).toBe(false);
  });

  // ── PATCH /v1/users/me ──────────────────────────────────────────────

  it("PATCH /v1/users/me returns 404 when user not synced", async () => {
    const res = await request(app)
      .patch("/v1/users/me")
      .send({ name: "New Name" });

    expect(res.status).toBe(404);
  });

  it("PATCH /v1/users/me updates name", async () => {
    await request(app).post("/v1/users/me/sync").send({});

    const res = await request(app)
      .patch("/v1/users/me")
      .send({ name: "Updated Name" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Name");
    expect(res.body.clerkUserId).toBe(INTEGRATION_CLERK_USER_ID);
  });

  it("PATCH /v1/users/me updates phone and instagram", async () => {
    await request(app).post("/v1/users/me/sync").send({});

    const res = await request(app)
      .patch("/v1/users/me")
      .send({ phone: "+5511999999999", instagram: "testuser" });

    expect(res.status).toBe(200);
    expect(res.body.phone).toBe("+5511999999999");
    expect(res.body.instagram).toBe("testuser");
  });

  it("PATCH /v1/users/me updates birthDate", async () => {
    await request(app).post("/v1/users/me/sync").send({});

    const res = await request(app)
      .patch("/v1/users/me")
      .send({ birthDate: "1995-06-15" });

    expect(res.status).toBe(200);
    expect(res.body.birthDate).toBe("1995-06-15");
  });

  it("PATCH /v1/users/me can set nullable fields to null", async () => {
    await request(app).post("/v1/users/me/sync").send({});

    // Set values first
    await request(app)
      .patch("/v1/users/me")
      .send({ phone: "+5511999999999", instagram: "testuser" });

    // Clear them
    const res = await request(app)
      .patch("/v1/users/me")
      .send({ phone: null, instagram: null });

    expect(res.status).toBe(200);
    expect(res.body.phone).toBeNull();
    expect(res.body.instagram).toBeNull();
  });

  it("PATCH /v1/users/me with invalid name returns 400", async () => {
    await request(app).post("/v1/users/me/sync").send({});

    const res = await request(app)
      .patch("/v1/users/me")
      .send({ name: "A" }); // min length is 2

    expect(res.status).toBe(400);
  });

  it("PATCH /v1/users/me preserves activeRole in response", async () => {
    await request(app)
      .post("/v1/users/me/sync")
      .send({ role: "student" });

    const res = await request(app)
      .patch("/v1/users/me")
      .send({ name: "Still Student" });

    expect(res.status).toBe(200);
    expect(res.body.activeRole).toBe("student");
  });

  // ── DELETE /v1/users/me ─────────────────────────────────────────────

  it("DELETE /v1/users/me returns 404 when user not synced", async () => {
    const res = await request(app).delete("/v1/users/me");

    expect(res.status).toBe(404);
  });

  it("DELETE /v1/users/me soft-deletes user and returns 204", async () => {
    await request(app).post("/v1/users/me/sync").send({});

    const res = await request(app).delete("/v1/users/me");

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it("DELETE /v1/users/me makes subsequent GET /v1/users/me return 404", async () => {
    await request(app).post("/v1/users/me/sync").send({});
    await request(app).delete("/v1/users/me");

    const me = await request(app).get("/v1/users/me");
    expect(me.status).toBe(404);
  });

  it("DELETE /v1/users/me is idempotent — second call returns 404", async () => {
    await request(app).post("/v1/users/me/sync").send({});

    const first = await request(app).delete("/v1/users/me");
    expect(first.status).toBe(204);

    const second = await request(app).delete("/v1/users/me");
    expect(second.status).toBe(404);
  });
});
