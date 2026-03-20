import type { Express } from "express";
import request from "supertest";
import { users } from "@tatame/db/schema";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { setDbForTest } from "./lib/db.js";
import { makeUser } from "./testing/factories/index.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

const MOCK_CLERK_USER_ID = "user_01integration_smoke";

vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void) => {
      next();
    },
  getAuth: () => ({ userId: MOCK_CLERK_USER_ID }),
}));

describe("createApp integration", () => {
  let app: Express;
  let ctx: Awaited<ReturnType<typeof setupIntegrationTest>>;

  beforeAll(async () => {
    ctx = await setupIntegrationTest();
    setDbForTest(ctx.db);
    const { createApp } = await import("./app.js");
    app = createApp();
  });

  afterEach(async () => {
    await ctx.truncateAll();
  });

  afterAll(async () => {
    await ctx.dropSchema();
  });

  it("GET /v1/health returns ok", async () => {
    const res = await request(app).get("/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, service: "tatame-api" });
  });

  it("GET /v1/ready reports database up (test Postgres)", async () => {
    const res = await request(app).get("/v1/ready");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      database: "up",
      redis: "skipped",
    });
  });

  it("GET /v1/users/me returns 404 when user row is missing", async () => {
    const res = await request(app).get("/v1/users/me");
    expect(res.status).toBe(404);
    expect(String((res.body as { error?: string }).error)).toContain(
      "not provisioned",
    );
  });

  it("GET /v1/users/me returns profile when user exists", async () => {
    const row = makeUser({ clerkUserId: MOCK_CLERK_USER_ID });
    await ctx.db.insert(users).values(row);

    const res = await request(app).get("/v1/users/me");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: row.id,
      clerkUserId: MOCK_CLERK_USER_ID,
      email: row.email,
      name: row.name,
      activeRole: null,
    });
  });
});
