import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("API smoke", () => {
  const app = createApp();

  it("GET /v1/health returns ok", async () => {
    const res = await request(app).get("/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, service: "tatame-api" });
  });

  it("GET /v1/users/me returns 503 when Clerk is not configured", async () => {
    const res = await request(app).get("/v1/users/me");
    expect(res.status).toBe(503);
    expect(String(res.body.error)).toContain("Clerk");
  });

  it("GET /v1/classes returns 503 when Clerk is not configured (authorized route)", async () => {
    const res = await request(app).get("/v1/classes");
    expect(res.status).toBe(503);
    expect(String(res.body.error)).toContain("Clerk");
  });
});
