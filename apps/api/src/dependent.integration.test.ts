import {
  asClerkUser,
  resetIntegrationClerkAuth,
} from "./testing/integration-clerk-mock.js";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setDbForTest } from "./lib/db.js";
import {
  insertApprovedPayoutAccount,
  insertSubscription,
  insertUserWithGlobalRole,
} from "./testing/integration-seed.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

const CLERK_MANAGER = "user_integration_dep_mgr";
const CLERK_STUDENT = "user_integration_dep_std";
const CLERK_OTHER = "user_integration_dep_other";

function utcMonthFirstIso(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

describe("Dependent flow integration", () => {
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

  /**
   * Manager with an academy that can charge, plus the plans the tests enrol in.
   * Returns everything the caller needs to act as either side.
   */
  async function seedAcademy(): Promise<{
    academyId: string;
    adultPlanId: string;
    kidsPlanId: string;
    otherAdultPlanId: string;
  }> {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Dependent Dojo" });
    expect(ac.status).toBe(201);
    const academyId = ac.body.id as string;

    // Pro, because the free tier caps an academy at one plan and these tests
    // need three.
    await insertSubscription(ctx.db, academyId, { plan: "pro" });
    await insertApprovedPayoutAccount(ctx.db, academyId);

    const makePlan = async (name: string, priceCents: number) => {
      const res = await request(app).post("/v1/subscriptions/plans").send({
        name,
        recurrenceMonths: 1,
        priceCents,
        weeklyCheckinLimit: null,
      });
      expect(res.status).toBe(201);
      return res.body.id as string;
    };

    return {
      academyId,
      adultPlanId: await makePlan("Adulto", 15_000),
      kidsPlanId: await makePlan("Kids", 12_000),
      otherAdultPlanId: await makePlan("Adulto Plus", 20_000),
    };
  }

  /** Puts `clerkUserId` in the academy as an approved member. */
  async function joinAcademy(
    clerkUserId: string,
    academyId: string,
  ): Promise<void> {
    asClerkUser(clerkUserId);
    const join = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(join.status).toBe(201);

    asClerkUser(CLERK_MANAGER);
    const approve = await request(app).patch(
      `/v1/memberships/${join.body.id}/approve`,
    );
    expect(approve.status).toBe(200);
  }

  async function createDependent(
    clerkUserId: string,
    name = "Joao",
  ): Promise<string> {
    asClerkUser(clerkUserId);
    const res = await request(app).post("/v1/dependents").send({
      name,
      birthDate: "2018-05-04",
      belt: "grey",
      stripes: 0,
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  it("refuses to register a dependent when the caller has no active academy membership", async () => {
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_STUDENT);
    const res = await request(app).post("/v1/dependents").send({
      name: "Joao",
      birthDate: "2018-05-04",
      belt: "grey",
      stripes: 0,
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("No active academy membership");
  });

  it("registers a dependent with its initial belt and returns it in the list", async () => {
    const { academyId } = await seedAcademy();
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");
    await joinAcademy(CLERK_STUDENT, academyId);

    const dependentId = await createDependent(CLERK_STUDENT);

    const list = await request(app).get("/v1/dependents/me");
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({
      id: dependentId,
      name: "Joao",
      academyId,
      currentBelt: { belt: "grey", stripes: 0 },
      subscriptionStatus: null,
    });

    const detail = await request(app).get(`/v1/dependents/${dependentId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.currentBelt).toEqual({ belt: "grey", stripes: 0 });
  });

  it("edits and soft-deletes a dependent", async () => {
    const { academyId } = await seedAcademy();
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");
    await joinAcademy(CLERK_STUDENT, academyId);
    const dependentId = await createDependent(CLERK_STUDENT);

    const edit = await request(app)
      .put(`/v1/dependents/${dependentId}`)
      .send({ name: "João Pedro" });
    expect(edit.status).toBe(200);
    expect(edit.body.name).toBe("João Pedro");

    const del = await request(app).delete(`/v1/dependents/${dependentId}`);
    expect(del.status).toBe(204);

    const list = await request(app).get("/v1/dependents/me");
    expect(list.body.items).toHaveLength(0);
  });

  it("keeps the dependent's subscription active when the guardian changes their own plan", async () => {
    const { academyId, adultPlanId, kidsPlanId, otherAdultPlanId } =
      await seedAcademy();
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");
    await joinAcademy(CLERK_STUDENT, academyId);
    const dependentId = await createDependent(CLERK_STUDENT);

    asClerkUser(CLERK_STUDENT);
    const ownEnrol = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId: adultPlanId });
    expect(ownEnrol.status).toBe(201);

    const depEnrol = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId: kidsPlanId, dependentId });
    expect(depEnrol.status).toBe(201);

    // The regression: switching your own plan must not touch the dependent's.
    const switched = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId: otherAdultPlanId });
    expect(switched.status).toBe(201);

    const depSub = await request(app).get(
      `/v1/subscriptions/dependent/${dependentId}`,
    );
    expect(depSub.status).toBe(200);
    expect(depSub.body.subscription).not.toBeNull();
    expect(depSub.body.subscription.id).toBe(depEnrol.body.subscription.id);
    expect(depSub.body.subscription.effectiveStatus).toBe("active");

    const ownSub = await request(app).get("/v1/subscriptions/me");
    expect(ownSub.body.subscription.planId).toBe(otherAdultPlanId);
  });

  it("keeps a dependent's payment out of the guardian's own payment list", async () => {
    const { academyId, adultPlanId, kidsPlanId } = await seedAcademy();
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");
    await joinAcademy(CLERK_STUDENT, academyId);
    const dependentId = await createDependent(CLERK_STUDENT);

    asClerkUser(CLERK_STUDENT);
    const ownEnrol = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId: adultPlanId });
    const depEnrol = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId: kidsPlanId, dependentId });

    // Only the dependent's month is paid.
    asClerkUser(CLERK_MANAGER);
    const pay = await request(app).post("/v1/payments").send({
      subscriptionId: depEnrol.body.subscription.id,
      amountCents: 12_000,
      referenceMonth: utcMonthFirstIso(),
    });
    expect(pay.status).toBe(201);

    asClerkUser(CLERK_STUDENT);
    const mine = await request(app).get("/v1/payments/me");
    expect(mine.status).toBe(200);
    expect(mine.body.items).toHaveLength(0);

    const theirs = await request(app).get(
      `/v1/payments/dependent/${dependentId}`,
    );
    expect(theirs.status).toBe(200);
    expect(theirs.body.items).toHaveLength(1);
    expect(theirs.body.items[0].dependentId).toBe(dependentId);

    // And the guardian's own month, once paid, belongs only to the guardian.
    asClerkUser(CLERK_MANAGER);
    await request(app).post("/v1/payments").send({
      subscriptionId: ownEnrol.body.subscription.id,
      amountCents: 15_000,
      referenceMonth: utcMonthFirstIso(),
    });

    asClerkUser(CLERK_STUDENT);
    const mineNow = await request(app).get("/v1/payments/me");
    expect(mineNow.body.items).toHaveLength(1);
    expect(mineNow.body.items[0].subscriptionId).toBe(
      ownEnrol.body.subscription.id,
    );
    expect(mineNow.body.items[0].dependentId).toBeNull();
  });

  it("records the dependent on a payment the manager confirms by hand", async () => {
    const { academyId, kidsPlanId } = await seedAcademy();
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");
    await joinAcademy(CLERK_STUDENT, academyId);
    const dependentId = await createDependent(CLERK_STUDENT);

    asClerkUser(CLERK_STUDENT);
    const depEnrol = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId: kidsPlanId, dependentId });

    asClerkUser(CLERK_MANAGER);
    const pay = await request(app).post("/v1/payments").send({
      subscriptionId: depEnrol.body.subscription.id,
      amountCents: 12_000,
      referenceMonth: utcMonthFirstIso(),
    });
    expect(pay.status).toBe(201);
    expect(pay.body.dependentId).toBe(dependentId);

    asClerkUser(CLERK_STUDENT);
    const history = await request(app).get(
      `/v1/payments/dependent/${dependentId}`,
    );
    expect(history.body.items).toHaveLength(1);
    expect(history.body.items[0].id).toBe(pay.body.id);
  });

  it("refuses to subscribe a dependent that belongs to someone else", async () => {
    const { academyId, kidsPlanId } = await seedAcademy();
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");
    await insertUserWithGlobalRole(ctx.db, CLERK_OTHER, "student");
    await joinAcademy(CLERK_STUDENT, academyId);
    await joinAcademy(CLERK_OTHER, academyId);

    const dependentId = await createDependent(CLERK_STUDENT);

    asClerkUser(CLERK_OTHER);
    const res = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId: kidsPlanId, dependentId });

    expect(res.status).toBe(403);

    // And nothing was written for the intruder.
    asClerkUser(CLERK_STUDENT);
    const depSub = await request(app).get(
      `/v1/subscriptions/dependent/${dependentId}`,
    );
    expect(depSub.body.subscription).toBeNull();
  });
});
