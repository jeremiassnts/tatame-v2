import "./testing/integration-clerk-mock.js";
import { eq } from "drizzle-orm";
import request from "supertest";
import { users } from "@tatame/db/schema";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { setDbForTest } from "./lib/db.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

const WEBHOOK_CLERK_ID = "user_wh_integration_99";

vi.mock("@clerk/express/webhooks", () => ({
  verifyWebhook: vi.fn(async () => ({
    type: "user.created" as const,
    data: {
      id: WEBHOOK_CLERK_ID,
      email_addresses: [
        { id: "ea_int", email_address: "webhook.integration@example.com" },
      ],
      primary_email_address_id: "ea_int",
      first_name: "Webhook",
      last_name: "Integration",
      image_url: null as string | null,
      username: null as string | null,
    },
  })),
}));

describe("Clerk webhook integration", () => {
  let app: import("express").Express;
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

  it("POST /v1/auth/webhooks/clerk upserts user from mocked verifyWebhook", async () => {
    const res = await request(app)
      .post("/v1/auth/webhooks/clerk")
      .set("Content-Type", "application/json")
      .send("{}");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true });

    const rows = await ctx.db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, WEBHOOK_CLERK_ID));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("webhook.integration@example.com");
  });
});
