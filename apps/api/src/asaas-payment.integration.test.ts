import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setDbForTest } from "./lib/db.js";
import {
  asClerkUser,
  resetIntegrationClerkAuth,
} from "./testing/integration-clerk-mock.js";
import {
  insertApprovedPayoutAccount,
  insertSubscription,
  insertUserWithGlobalRole,
} from "./testing/integration-seed.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

/**
 * The loop that actually moves money: a student opens a charge, Asaas delivers
 * a `PAYMENT_*` event, and a payment row appears. Nothing else in the system
 * writes one — no client is trusted to say money arrived — so this is the path
 * that has to work end to end, through the real route, the real dispatcher and
 * real Postgres.
 *
 * The webhook payloads are shaped after the delivery captured from the sandbox
 * on 2026-09-29: `{ id, event, dateCreated, account, payment }`, with
 * `checkoutSession` on the payment and `externalReference` null.
 */

const CLERK_MANAGER = "user_integration_asaaspay_mgr";
const CLERK_STUDENT = "user_integration_asaaspay_std";
const WEBHOOK_TOKEN = "w".repeat(40);

const CHECKOUT_ID = "6153e592-5def-41b6-a3bc-c160306eb25a";

function currentReferenceMonth(): string {
  return new Date().toISOString().slice(0, 7) + "-01";
}

/** Only what the two charge paths touch; anything else is a loud failure. */
function fakeAsaas() {
  const calls: { method: string; url: string; body: unknown }[] = [];

  const handler = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({ method, url, body: init.body });
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });

    if (method === "GET" && url.includes("/v3/customers?")) {
      return json(200, { data: [] });
    }
    if (method === "POST" && url.endsWith("/v3/customers")) {
      return json(200, { id: "cus_int_1", name: "Aluno", cpfCnpj: "41763193640" });
    }
    if (method === "POST" && url.endsWith("/v3/payments")) {
      return json(200, { id: "pay_int_1", status: "PENDING", value: 150 });
    }
    if (method === "GET" && url.endsWith("/pixQrCode")) {
      return json(200, {
        success: true,
        encodedImage: "iVBORw0KGgo",
        payload: "00020101021226820014br.gov.bcb.pix",
        expirationDate: "2027-10-02 23:59:59",
      });
    }
    // The reuse path reads a stored charge back rather than trusting the row:
    // Asaas serves a QR for a deleted charge exactly as for a live one.
    if (method === "GET" && url.includes("/v3/payments/")) {
      return json(200, {
        id: "pay_int_1",
        status: "PENDING",
        value: 150,
        deleted: false,
      });
    }
    if (method === "POST" && url.endsWith("/v3/checkouts")) {
      return json(200, {
        id: CHECKOUT_ID,
        link: `https://sandbox.asaas.test/checkoutSession/show/${CHECKOUT_ID}`,
        status: "ACTIVE",
      });
    }
    throw new Error(`unexpected Asaas call: ${method} ${url}`);
  });

  return { handler, calls };
}

function paymentEvent(overrides: Record<string, unknown> = {}) {
  const { payment, ...rest } = overrides as {
    payment?: Record<string, unknown>;
  };
  return {
    id: "evt_integration_pay",
    event: "PAYMENT_RECEIVED",
    dateCreated: "2026-09-29 12:06:31",
    account: { id: "c2b4388d-d81b-4a76-bad3-8d4519b302e1", ownerId: null },
    payment: {
      id: "pay_int_1",
      status: "RECEIVED",
      value: 150.0,
      netValue: 149.01,
      billingType: "PIX",
      checkoutSession: null,
      externalReference: null,
      confirmedDate: "2026-09-29",
      paymentDate: "2026-09-29",
      deleted: false,
      ...payment,
    },
    ...rest,
  };
}

describe("Asaas payment webhook integration", () => {
  let app: import("express").Express;
  let ctx: Awaited<ReturnType<typeof setupIntegrationTest>>;
  let asaas: ReturnType<typeof fakeAsaas>;
  const originalEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const key of [
      "ASAAS_API_KEY",
      "ASAAS_BASE_URL",
      "ASAAS_WEBHOOK_TOKEN",
      "API_PUBLIC_URL",
    ]) {
      originalEnv[key] = process.env[key];
    }
    process.env.ASAAS_API_KEY = "$aact_root_integration";
    process.env.ASAAS_BASE_URL = "https://api-sandbox.asaas.test";
    process.env.ASAAS_WEBHOOK_TOKEN = WEBHOOK_TOKEN;
    process.env.API_PUBLIC_URL = "https://api.tatame.test";

    ctx = await setupIntegrationTest();
    setDbForTest(ctx.db);
    const { createApp } = await import("./app.js");
    app = createApp();
  });

  beforeEach(async () => {
    await ctx.truncateAll();
    resetIntegrationClerkAuth();
    asaas = fakeAsaas();
    vi.stubGlobal("fetch", asaas.handler);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await ctx.dropSchema();
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  /**
   * A manager who can receive, a student enrolled in a R$ 150 plan. The
   * manager subscription is **pro**: automatic payment is a paid-plan feature,
   * so both charge paths answer 403 `PLAN_LIMIT_PAYMENTS` on free.
   */
  async function seedEnrolledStudent() {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const academy = await request(app)
      .post("/v1/academies")
      .send({ name: "Asaas Dojo" });
    expect(academy.status).toBe(201);
    const academyId = academy.body.id as string;
    await insertSubscription(ctx.db, academyId, { plan: "pro" });
    await insertApprovedPayoutAccount(ctx.db, academyId);

    asClerkUser(CLERK_STUDENT);
    const join = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(join.status).toBe(201);

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${join.body.id}/approve`);

    const plan = await request(app).post("/v1/subscriptions/plans").send({
      name: "Mensal",
      recurrenceMonths: 1,
      priceCents: 15_000,
      weeklyCheckinLimit: null,
    });
    expect(plan.status).toBe(201);

    asClerkUser(CLERK_STUDENT);
    const enroll = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId: plan.body.id });
    expect(enroll.status).toBe(201);

    return {
      academyId,
      subscriptionId: enroll.body.subscription.id as string,
    };
  }

  const deliver = (body: object) =>
    request(app)
      .post("/v1/webhooks/asaas")
      .set("asaas-access-token", WEBHOOK_TOKEN)
      .send(body);

  it("takes a Pix charge from QR code to a payment row", async () => {
    const { academyId, subscriptionId } = await seedEnrolledStudent();

    asClerkUser(CLERK_STUDENT);
    const charge = await request(app)
      .post("/v1/payments/pix")
      .send({ cpfCnpj: "41763193640" });
    expect(charge.status).toBe(200);
    expect(charge.body.paymentId).toBe("pay_int_1");

    // Nothing is recorded by opening a charge.
    asClerkUser(CLERK_MANAGER);
    expect((await request(app).get("/v1/payments")).body.items).toHaveLength(0);

    expect((await deliver(paymentEvent())).status).toBe(200);

    asClerkUser(CLERK_MANAGER);
    const listed = await request(app).get("/v1/payments");
    expect(listed.body.items).toHaveLength(1);
    expect(listed.body.items[0]).toMatchObject({
      subscriptionId,
      academyId,
      amountCents: 15_000,
      method: "pix",
      asaasPaymentId: "pay_int_1",
      referenceMonth: currentReferenceMonth(),
      confirmedBy: null,
    });
  });

  // Asaas delivers at least once, and sends CONFIRMED before RECEIVED for the
  // same money. The unique constraint on `payments.asaas_payment_id` is what
  // holds — only Postgres can answer this.
  it("records one payment for CONFIRMED, RECEIVED and a replay of both", async () => {
    await seedEnrolledStudent();

    asClerkUser(CLERK_STUDENT);
    await request(app).post("/v1/payments/pix").send({ cpfCnpj: "41763193640" });

    for (const event of ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]) {
      expect((await deliver(paymentEvent({ event }))).status).toBe(200);
      expect((await deliver(paymentEvent({ event }))).status).toBe(200);
    }

    asClerkUser(CLERK_MANAGER);
    expect((await request(app).get("/v1/payments")).body.items).toHaveLength(1);
  });

  // The card rail's reconciliation: the payment id is one we have never seen,
  // and `checkoutSession` is the only way back to the pending row.
  it("takes a card checkout to a payment row through its checkout session", async () => {
    const { subscriptionId } = await seedEnrolledStudent();

    asClerkUser(CLERK_STUDENT);
    const checkout = await request(app).post("/v1/payments/checkout").send({});
    expect(checkout.status).toBe(200);
    expect(checkout.body.checkoutUrl).toContain(CHECKOUT_ID);

    await deliver(
      paymentEvent({
        event: "PAYMENT_CONFIRMED",
        payment: {
          id: "pay_from_checkout",
          status: "CONFIRMED",
          billingType: "CREDIT_CARD",
          netValue: 146.53,
          checkoutSession: CHECKOUT_ID,
          paymentDate: null,
        },
      }),
    );

    asClerkUser(CLERK_MANAGER);
    const listed = await request(app).get("/v1/payments");
    expect(listed.body.items).toHaveLength(1);
    expect(listed.body.items[0]).toMatchObject({
      subscriptionId,
      amountCents: 15_000,
      method: "stripe",
      asaasPaymentId: "pay_from_checkout",
      referenceMonth: currentReferenceMonth(),
    });
  });

  // Once the month is paid, the charge paths must refuse rather than open a
  // second one — which is only true if the webhook really wrote the row.
  it("closes the month to new charges once the payment lands", async () => {
    await seedEnrolledStudent();

    asClerkUser(CLERK_STUDENT);
    await request(app).post("/v1/payments/pix").send({ cpfCnpj: "41763193640" });
    await deliver(paymentEvent());

    asClerkUser(CLERK_STUDENT);
    const again = await request(app)
      .post("/v1/payments/pix")
      .send({ cpfCnpj: "41763193640" });
    expect(again.status).toBe(409);

    const byCard = await request(app).post("/v1/payments/checkout").send({});
    expect(byCard.status).toBe(409);
  });

  it("refuses a payment delivery whose token does not match", async () => {
    await seedEnrolledStudent();

    asClerkUser(CLERK_STUDENT);
    await request(app).post("/v1/payments/pix").send({ cpfCnpj: "41763193640" });

    const forged = await request(app)
      .post("/v1/webhooks/asaas")
      .set("asaas-access-token", "not-the-token")
      .send(paymentEvent());
    expect(forged.status).toBe(401);

    asClerkUser(CLERK_MANAGER);
    expect((await request(app).get("/v1/payments")).body.items).toHaveLength(0);
  });

  // D5 deletes the month's open charge on every manual settlement. The
  // delivery that follows must not undo anything.
  it("accepts a PAYMENT_DELETED without recording or removing anything", async () => {
    await seedEnrolledStudent();

    asClerkUser(CLERK_STUDENT);
    await request(app).post("/v1/payments/pix").send({ cpfCnpj: "41763193640" });

    const deleted = await deliver(paymentEvent({ event: "PAYMENT_DELETED" }));
    expect(deleted.status).toBe(200);

    asClerkUser(CLERK_MANAGER);
    expect((await request(app).get("/v1/payments")).body.items).toHaveLength(0);

    // The charge is still open, so the student is still handed the same one.
    asClerkUser(CLERK_STUDENT);
    const retry = await request(app)
      .post("/v1/payments/pix")
      .send({ cpfCnpj: "41763193640" });
    expect(retry.status).toBe(200);
  });

  it("answers 200 to a paid charge it cannot place, rather than retrying forever", async () => {
    await seedEnrolledStudent();

    const orphan = await deliver(
      paymentEvent({ payment: { id: "pay_never_opened" } }),
    );
    expect(orphan.status).toBe(200);

    asClerkUser(CLERK_MANAGER);
    expect((await request(app).get("/v1/payments")).body.items).toHaveLength(0);
  });
});
