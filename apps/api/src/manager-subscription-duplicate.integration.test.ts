import type { Database } from "@tatame/db";
import { users } from "@tatame/db/schema";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  asClerkUser,
  resetIntegrationClerkAuth,
} from "./testing/integration-clerk-mock.js";
import { setDbForTest } from "./lib/db.js";
import {
  insertSubscription,
  insertUserWithGlobalRole,
  insertUserWithoutRole,
} from "./testing/integration-seed.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

const CLERK_MANAGER = "user_integration_dup_sub_mgr";

/**
 * TAT-185. A real customer ended up with two Pro subscriptions on one Stripe
 * Customer: nothing between the button and `checkout.sessions.create` ever read
 * `manager_subscriptions`, so a manager who revisited `/cadastro` simply bought
 * a second 30-day trial.
 *
 * Stripe is deliberately left unconfigured here. The guard runs before the
 * service reaches Stripe, so a refusal is a clean 409, and a caller who is
 * *allowed* through falls into the 503 the missing Stripe key produces — which
 * is exactly the evidence that the guard let them past.
 */
describe("Duplicate Pro subscription guard", () => {
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

  async function createAcademyAsManager(): Promise<string> {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    asClerkUser(CLERK_MANAGER);
    const res = await request(app)
      .post("/v1/academies")
      .send({ name: "Duplicate Guard Dojo" });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  function postCheckout() {
    return request(app).post("/v1/manager-subscriptions/checkout").send({
      successUrl: "https://tatame.test/assinatura-confirmada",
      cancelUrl: "https://tatame.test/cadastro",
    });
  }

  async function setPendingSubscription(db: Database, clerkUserId: string) {
    await db
      .update(users)
      .set({
        pendingStripeCustomerId: "cus_pending",
        pendingStripeSubscriptionId: "sub_pending",
      })
      .where(eq(users.clerkUserId, clerkUserId));
  }

  describe("POST /manager-subscriptions/checkout", () => {
    it.each(["trialing", "active"] as const)(
      "refuses a caller whose academy is %s",
      async (status) => {
        const academyId = await createAcademyAsManager();
        await insertSubscription(ctx.db, academyId, { status });

        const res = await postCheckout();

        expect(res.status).toBe(409);
      },
    );

    it("refuses a caller who subscribed but has not created an academy yet", async () => {
      await insertUserWithoutRole(ctx.db, CLERK_MANAGER);
      await setPendingSubscription(ctx.db, CLERK_MANAGER);
      asClerkUser(CLERK_MANAGER);

      const res = await postCheckout();

      expect(res.status).toBe(409);
    });

    it("answers with a code the client can branch on and prose a person can read", async () => {
      const academyId = await createAcademyAsManager();
      await insertSubscription(ctx.db, academyId, { status: "trialing" });

      const res = await postCheckout();

      expect(res.body.error).toBe("ALREADY_SUBSCRIBED");
      expect(res.body.message).toMatch(/assinatura/i);
    });

    // Resubscribing has to keep working, so these three states stay eligible.
    // 503 is the unconfigured Stripe key — reaching it means the guard passed.
    it.each(["canceled", "incomplete", "past_due"] as const)(
      "lets a caller whose academy is %s through to Stripe",
      async (status) => {
        const academyId = await createAcademyAsManager();
        await insertSubscription(ctx.db, academyId, { status });

        const res = await postCheckout();

        expect(res.status).not.toBe(409);
      },
    );

    it("lets a caller with no subscription at all through to Stripe", async () => {
      await createAcademyAsManager();

      const res = await postCheckout();

      expect(res.status).not.toBe(409);
    });

    /**
     * The endpoint promotes its caller to manager on the way to Stripe. A
     * request it refuses must not leave that behind — a refusal that mutates the
     * caller is not a refusal.
     */
    it("does not promote a refused caller to manager", async () => {
      await insertUserWithoutRole(ctx.db, CLERK_MANAGER);
      await setPendingSubscription(ctx.db, CLERK_MANAGER);
      asClerkUser(CLERK_MANAGER);

      expect((await postCheckout()).status).toBe(409);

      const me = await request(app).get("/v1/users/me");
      expect(me.body.activeRole).toBeNull();
    });
  });

  /**
   * `/cadastro` renders a checkout CTA for any authenticated user. It needs the
   * same answer the endpoint gives *before* it draws the button, and it cannot
   * use `GET /manager-subscriptions/me`: that one demands the manager role and an
   * active academy, which is precisely what the pending-academy case lacks.
   */
  describe("GET /manager-subscriptions/checkout-eligibility", () => {
    function getEligibility() {
      return request(app).get("/v1/manager-subscriptions/checkout-eligibility");
    }

    it("reports a trialing manager as ineligible", async () => {
      const academyId = await createAcademyAsManager();
      await insertSubscription(ctx.db, academyId, { status: "trialing" });

      const res = await getEligibility();

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        eligible: false,
        reason: "ALREADY_SUBSCRIBED",
      });
    });

    it("reports a pending-academy subscriber as ineligible", async () => {
      await insertUserWithoutRole(ctx.db, CLERK_MANAGER);
      await setPendingSubscription(ctx.db, CLERK_MANAGER);
      asClerkUser(CLERK_MANAGER);

      const res = await getEligibility();

      expect(res.body).toEqual({ eligible: false, reason: "ALREADY_SUBSCRIBED" });
    });

    it("reports a canceled manager as eligible, so they can resubscribe", async () => {
      const academyId = await createAcademyAsManager();
      await insertSubscription(ctx.db, academyId, { status: "canceled" });

      const res = await getEligibility();

      expect(res.body).toEqual({ eligible: true, reason: null });
    });

    /**
     * The web signs the user up with Clerk and lands them on `/cadastro` before
     * anything of ours exists for them. A user we have never seen cannot have a
     * subscription, and must not be told to go look at one.
     */
    it("reports a user we have never provisioned as eligible", async () => {
      asClerkUser("user_integration_dup_sub_stranger");

      const res = await getEligibility();

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ eligible: true, reason: null });
    });
  });
});
