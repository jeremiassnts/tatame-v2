import "./testing/integration-clerk-mock.js";
import { eq } from "drizzle-orm";
import request from "supertest";
import { academies, users } from "@tatame/db/schema";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { setDbForTest } from "./lib/db.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";
import { makeAcademy } from "./testing/factories/index.js";
import { insertUserWithGlobalRole } from "./testing/integration-seed.js";

const WEBHOOK_CLERK_ID = "user_wh_integration_99";

const verifyWebhookMock = vi.fn(async () => ({
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
}));

vi.mock("@clerk/express/webhooks", () => ({
  verifyWebhook: (...args: unknown[]) => verifyWebhookMock(...args),
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
    verifyWebhookMock.mockReset();
    await ctx.truncateAll();
  });

  afterAll(async () => {
    await ctx.dropSchema();
  });

  // ─── user.created ──────────────────────────────────────────────

  it("POST /v1/auth/webhooks/clerk upserts user from mocked verifyWebhook", async () => {
    verifyWebhookMock.mockResolvedValueOnce({
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
    });

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

  // ─── Webhook idempotency ──────────────────────────────────────

  it("user.created webhook is idempotent — duplicate call updates instead of failing", async () => {
    const payload = {
      type: "user.created" as const,
      data: {
        id: WEBHOOK_CLERK_ID,
        email_addresses: [
          { id: "ea_int", email_address: "webhook.idem@example.com" },
        ],
        primary_email_address_id: "ea_int",
        first_name: "Original",
        last_name: "Name",
        image_url: null as string | null,
        username: null as string | null,
      },
    };

    verifyWebhookMock.mockResolvedValueOnce(payload);
    const res1 = await request(app)
      .post("/v1/auth/webhooks/clerk")
      .set("Content-Type", "application/json")
      .send("{}");
    expect(res1.status).toBe(200);

    // Second identical webhook (Clerk retry)
    verifyWebhookMock.mockResolvedValueOnce(payload);
    const res2 = await request(app)
      .post("/v1/auth/webhooks/clerk")
      .set("Content-Type", "application/json")
      .send("{}");
    expect(res2.status).toBe(200);

    // Should still be exactly one user
    const rows = await ctx.db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, WEBHOOK_CLERK_ID));
    expect(rows).toHaveLength(1);
  });

  it("user.updated webhook updates existing user data (idempotent upsert)", async () => {
    // First: create the user
    verifyWebhookMock.mockResolvedValueOnce({
      type: "user.created" as const,
      data: {
        id: WEBHOOK_CLERK_ID,
        email_addresses: [
          { id: "ea_int", email_address: "old@example.com" },
        ],
        primary_email_address_id: "ea_int",
        first_name: "Old",
        last_name: "Name",
        image_url: null as string | null,
        username: null as string | null,
      },
    });
    await request(app)
      .post("/v1/auth/webhooks/clerk")
      .set("Content-Type", "application/json")
      .send("{}");

    // Then: update via user.updated
    verifyWebhookMock.mockResolvedValueOnce({
      type: "user.updated" as const,
      data: {
        id: WEBHOOK_CLERK_ID,
        email_addresses: [
          { id: "ea_int", email_address: "new@example.com" },
        ],
        primary_email_address_id: "ea_int",
        first_name: "New",
        last_name: "Name",
        image_url: "https://img.example.com/new.jpg",
        username: null as string | null,
      },
    });
    const res = await request(app)
      .post("/v1/auth/webhooks/clerk")
      .set("Content-Type", "application/json")
      .send("{}");
    expect(res.status).toBe(200);

    const rows = await ctx.db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, WEBHOOK_CLERK_ID));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("new@example.com");
    expect(rows[0]?.name).toBe("New Name");
    expect(rows[0]?.profileImageUrl).toBe("https://img.example.com/new.jpg");
  });

  // ─── user.deleted ─────────────────────────────────────────────

  it("user.deleted webhook deletes user without academies", async () => {
    // Create user in DB first
    verifyWebhookMock.mockResolvedValueOnce({
      type: "user.created" as const,
      data: {
        id: WEBHOOK_CLERK_ID,
        email_addresses: [
          { id: "ea_del", email_address: "delete.me@example.com" },
        ],
        primary_email_address_id: "ea_del",
        first_name: "Delete",
        last_name: "Me",
        image_url: null as string | null,
        username: null as string | null,
      },
    });
    await request(app)
      .post("/v1/auth/webhooks/clerk")
      .set("Content-Type", "application/json")
      .send("{}");

    // Now delete
    verifyWebhookMock.mockResolvedValueOnce({
      type: "user.deleted" as const,
      data: { id: WEBHOOK_CLERK_ID },
    });
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
    expect(rows).toHaveLength(0);
  });

  // ─── Manager cannot delete account with active academy ────────

  it("user.deleted webhook returns 409 when manager owns active academies", async () => {
    const clerkId = "user_manager_owns_academy";

    // Insert manager user directly in DB
    const manager = await insertUserWithGlobalRole(ctx.db, clerkId, "manager");

    // Insert an academy owned by this manager
    const academy = makeAcademy({ ownerId: manager.id });
    await ctx.db.insert(academies).values(academy);

    // Try to delete manager via webhook
    verifyWebhookMock.mockResolvedValueOnce({
      type: "user.deleted" as const,
      data: { id: clerkId },
    });
    const res = await request(app)
      .post("/v1/auth/webhooks/clerk")
      .set("Content-Type", "application/json")
      .send("{}");

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: "Cannot delete user who owns active academies",
    });

    // User should still exist in DB
    const rows = await ctx.db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkId));
    expect(rows).toHaveLength(1);
  });
});
