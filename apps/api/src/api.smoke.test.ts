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
   * The inverse of the test this replaces. Those two endpoints were the Pix
   * screen of the 2.1.2 build, kept alive past the Asaas cutover because the
   * store build could not be updated over the air; `MIN_MOBILE_VERSION` reached
   * 2.1.3, the force-update screen now stops every build that called them, and
   * TAT-187 removed them.
   *
   * `POST /v1/payments/pix` is asserted in the same test on purpose. A `404`
   * alone cannot tell a removed route from a router that stopped mounting, and
   * the second is a total outage that would read here as success.
   */
  it("no longer serves the AbacatePay Pix rail", async () => {
    const created = await request(app).post("/v1/payments/checkout/pix").send({});
    expect(created.status).toBe(404);

    const status = await request(app).get("/v1/payments/pix-status/pix_char_x");
    expect(status.status).toBe(404);

    const live = await request(app).post("/v1/payments/pix").send({});
    expect(live.status).toBe(503);
    expect(String((live.body as { error?: unknown }).error)).toContain("Clerk");
  });

  /**
   * The recording side of the same rail. Nothing can deliver here any more — no
   * QR code can be created — and a delivery that did arrive used to get a `200`
   * and write nothing.
   *
   * `/v1/webhooks/stripe` carries the same load as the live sibling above: both
   * paths are served by `createWebhookRouter`, so its `503` for the missing
   * webhook secret proves the router is still mounted.
   */
  it("no longer accepts AbacatePay webhook deliveries", async () => {
    const dropped = await request(app)
      .post("/v1/webhooks/abacatepay")
      .send({ event: "billing.paid" });
    expect(dropped.status).toBe(404);

    const live = await request(app).post("/v1/webhooks/stripe").send({});
    expect(live.status).toBe(503);
  });

  it("GET /v1/classes returns 503 when Clerk is not configured (authorized route)", async () => {
    const res = await request(app).get("/v1/classes");
    expect(res.status).toBe(503);
    const err = (res.body as { error?: unknown }).error;
    expect(String(err)).toContain("Clerk");
  });
});
