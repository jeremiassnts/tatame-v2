import {
  INTEGRATION_CLERK_USER_ID,
  resetIntegrationClerkAuth,
} from "./testing/integration-clerk-mock.js";
import request from "supertest";
import { eq } from "drizzle-orm";
import { users } from "@tatame/db/schema";
import {
  afterAll,
  afterEach,
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

  afterEach(async () => {
    resetIntegrationClerkAuth();
    await ctx.truncateAll();
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
});
