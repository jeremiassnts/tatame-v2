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
    const err = (res.body as { error?: unknown }).error;
    expect(String(err)).toContain("Clerk");
  });

  /**
   * The app on the stores is 2.1.2, there is no OTA, and these are the two
   * endpoints its Pix screen calls. A 404 on either is a student who opens the
   * app and cannot pay. They outlive the cutover on purpose and go only once
   * `MIN_MOBILE_VERSION` has moved past the build that stopped calling them.
   *
   * 503-with-Clerk rather than "not 404": it proves the route is mounted *and*
   * still behind `authorize`, which a bare existence check would not.
   */
  it("still serves the Pix rail the shipped app calls", async () => {
    const created = await request(app).post("/v1/payments/checkout/pix").send({});
    expect(created.status).toBe(503);
    expect(String((created.body as { error?: unknown }).error)).toContain("Clerk");

    const status = await request(app).get("/v1/payments/pix-status/pix_char_x");
    expect(status.status).toBe(503);
    expect(String((status.body as { error?: unknown }).error)).toContain("Clerk");
  });

  it("GET /v1/classes returns 503 when Clerk is not configured (authorized route)", async () => {
    const res = await request(app).get("/v1/classes");
    expect(res.status).toBe(503);
    const err = (res.body as { error?: unknown }).error;
    expect(String(err)).toContain("Clerk");
  });
});
