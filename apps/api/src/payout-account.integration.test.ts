import { randomBytes } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  asClerkUser,
  resetIntegrationClerkAuth,
} from "./testing/integration-clerk-mock.js";
import { setDbForTest } from "./lib/db.js";
import {
  insertFreeSubscription,
  insertUserWithGlobalRole,
} from "./testing/integration-seed.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

const CLERK_MANAGER = "user_integration_payout_mgr";
const CLERK_STUDENT = "user_integration_payout_std";
const WEBHOOK_TOKEN = "w".repeat(40);

const ONBOARDING_FORM = {
  name: "Academia Tatame LTDA",
  email: "financeiro@tatame.test",
  cpfCnpj: "12.345.678/0001-99",
  companyType: "LIMITED",
  mobilePhone: "(11) 99999-9999",
  incomeValue: 15000,
  address: "Rua das Flores",
  addressNumber: "100",
  province: "Centro",
  postalCode: "01001-000",
};

/**
 * Stands in for Asaas. Only the endpoints the onboarding round trip touches
 * are implemented; anything else is a loud failure rather than a silent 200,
 * so a request this test did not intend shows up as one.
 */
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

    if (method === "POST" && url.endsWith("/v3/accounts")) {
      return json(200, {
        id: "acc_integration_1",
        walletId: "wal_integration_1",
        accessToken: { apiKey: "$aact_subaccount_integration" },
      });
    }
    if (method === "GET" && url.endsWith("/v3/myAccount/documents")) {
      return json(200, {
        rejectReasons: null,
        data: [
          {
            id: "grp_id",
            status: "NOT_SENT",
            type: "IDENTIFICATION",
            title: "Documento de identificação",
            description: "Envie o RG ou a CNH",
            onboardingUrl: null,
            documents: [],
          },
          {
            id: "grp_link",
            status: "PENDING",
            type: "SOCIAL_CONTRACT",
            title: "Contrato social",
            description: "Finalize pelo link",
            onboardingUrl: "https://onboarding.asaas.test/abc",
            documents: [],
          },
        ],
      });
    }
    if (method === "POST" && url.includes("/v3/myAccount/documents/")) {
      return json(200, { id: "doc_1", status: "PENDING" });
    }
    if (method === "GET" && url.endsWith("/v3/myAccount/status")) {
      return json(200, {
        id: "acc_integration_1",
        commercialInfo: "APPROVED",
        bankAccountInfo: "APPROVED",
        documentation: "PENDING",
        general: "PENDING",
      });
    }
    if (method === "GET" && url.endsWith("/v3/myAccount/fees")) {
      return json(200, {
        payment: {
          pix: {
            fixedFeeValue: 1.99,
            percentageFee: 0,
            minimumFeeValue: 0,
            maximumFeeValue: 0,
            monthlyCreditsWithoutFee: 10,
            creditsReceivedOfCurrentMonth: 2,
          },
          creditCard: {
            operationValue: 0.49,
            oneInstallmentPercentage: 2.99,
            daysToReceive: 30,
          },
        },
      });
    }
    throw new Error(`unexpected Asaas call: ${method} ${url}`);
  });

  return { handler, calls };
}

function accountStatusEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_integration_1",
    event: "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED",
    dateCreated: "2026-09-12 10:00:00",
    account: { id: "acc_integration_1", ownerId: null },
    accountStatus: {
      id: "sta_1",
      commercialInfo: "APPROVED",
      bankAccountInfo: "APPROVED",
      documentation: "APPROVED",
      general: "APPROVED",
    },
    ...overrides,
  };
}

describe("Payout account integration", () => {
  let app: import("express").Express;
  let ctx: Awaited<ReturnType<typeof setupIntegrationTest>>;
  let asaas: ReturnType<typeof fakeAsaas>;
  const originalEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const key of [
      "ASAAS_API_KEY",
      "ASAAS_BASE_URL",
      "ASAAS_WEBHOOK_TOKEN",
      "PAYOUT_ACCOUNT_ENCRYPTION_KEY",
      "API_PUBLIC_URL",
    ]) {
      originalEnv[key] = process.env[key];
    }
    process.env.ASAAS_API_KEY = "$aact_root_integration";
    process.env.ASAAS_BASE_URL = "https://api-sandbox.asaas.test";
    process.env.ASAAS_WEBHOOK_TOKEN = WEBHOOK_TOKEN;
    process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY = randomBytes(32).toString("hex");
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

  async function seedAcademy() {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    asClerkUser(CLERK_MANAGER);
    const created = await request(app)
      .post("/v1/academies")
      .send({ name: "Payout Dojo" });
    expect(created.status).toBe(201);
    const academyId = created.body.id as string;
    await insertFreeSubscription(ctx.db, academyId);
    return academyId;
  }

  it("walks a manager from no account to approved and able to sell a plan", async () => {
    await seedAcademy();

    // Nothing yet — the Financeiro card shows the call to action.
    const empty = await request(app).get("/v1/payout-account");
    expect(empty.status).toBe(200);
    expect(empty.body.account).toBeNull();

    // Selling is impossible before the academy can receive.
    const tooEarly = await request(app).post("/v1/subscriptions/plans").send({
      name: "Mensal",
      recurrenceMonths: 1,
      priceCents: 15_000,
      weeklyCheckinLimit: null,
    });
    expect(tooEarly.status).toBe(403);
    // The code travels in `error`, the convention PLAN_LIMIT_* already uses,
    // so the app can route the manager to onboarding instead of showing prose.
    expect(tooEarly.body.error).toBe("PAYOUT_ACCOUNT_REQUIRED");

    // Onboarding.
    const created = await request(app).post("/v1/payout-account").send(ONBOARDING_FORM);
    expect(created.status).toBe(201);
    expect(created.body.account).toMatchObject({
      externalAccountId: "acc_integration_1",
      walletId: "wal_integration_1",
      status: "pending",
    });
    expect(JSON.stringify(created.body)).not.toContain("$aact_subaccount_integration");

    // The document list separates what can be uploaded from what cannot.
    const documents = await request(app).get("/v1/payout-account/documents");
    expect(documents.status).toBe(200);
    expect(documents.body.groups).toHaveLength(2);
    expect(documents.body.groups[0]).toMatchObject({ id: "grp_id", canUploadInApp: true });
    expect(documents.body.groups[1]).toMatchObject({
      id: "grp_link",
      canUploadInApp: false,
      onboardingUrl: "https://onboarding.asaas.test/abc",
    });

    // Pull to refresh reads the live status rather than trusting the row.
    const refreshed = await request(app).get("/v1/payout-account/status");
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.account.status).toBe("awaiting_documents");

    // Asaas approves.
    const webhook = await request(app)
      .post("/v1/webhooks/asaas")
      .set("asaas-access-token", WEBHOOK_TOKEN)
      .send(accountStatusEvent());
    expect(webhook.status).toBe(200);

    const approved = await request(app).get("/v1/payout-account");
    expect(approved.body.account.status).toBe("approved");
    expect(approved.body.account.approvedAt).toBeTruthy();

    // And now the plan can be created.
    const plan = await request(app).post("/v1/subscriptions/plans").send({
      name: "Mensal",
      recurrenceMonths: 1,
      priceCents: 15_000,
      weeklyCheckinLimit: null,
    });
    expect(plan.status).toBe(201);
  });

  it("refuses a second account for the same academy", async () => {
    await seedAcademy();

    const first = await request(app).post("/v1/payout-account").send(ONBOARDING_FORM);
    expect(first.status).toBe(201);

    const second = await request(app).post("/v1/payout-account").send(ONBOARDING_FORM);
    expect(second.status).toBe(409);

    // Exactly one subaccount was created at Asaas — a second is unrecoverable.
    const creations = asaas.calls.filter((c) => c.url.endsWith("/v3/accounts"));
    expect(creations).toHaveLength(1);
  });

  it("registers the webhooks against our own public url", async () => {
    await seedAcademy();
    await request(app).post("/v1/payout-account").send(ONBOARDING_FORM);

    const creation = asaas.calls.find((c) => c.url.endsWith("/v3/accounts"))!;
    const body = JSON.parse(creation.body as string) as {
      webhooks: { url: string; authToken: string; events: string[] }[];
      cpfCnpj: string;
      mobilePhone: string;
      postalCode: string;
    };

    expect(body.webhooks.every((w) => w.url === "https://api.tatame.test/v1/webhooks/asaas")).toBe(true);
    expect(body.webhooks.every((w) => w.authToken === WEBHOOK_TOKEN)).toBe(true);
    // The form is masked; Asaas gets digits.
    expect(body.cpfCnpj).toBe("12345678000199");
    expect(body.mobilePhone).toBe("11999999999");
    expect(body.postalCode).toBe("01001000");
  });

  it("rejects a webhook whose token does not match", async () => {
    await seedAcademy();
    await request(app).post("/v1/payout-account").send(ONBOARDING_FORM);

    const forged = await request(app)
      .post("/v1/webhooks/asaas")
      .set("asaas-access-token", "not-the-token")
      .send(accountStatusEvent());
    expect(forged.status).toBe(401);

    const missing = await request(app)
      .post("/v1/webhooks/asaas")
      .send(accountStatusEvent());
    expect(missing.status).toBe(401);

    const account = await request(app).get("/v1/payout-account");
    expect(account.body.account.status).toBe("pending");
  });

  it("records one approval when the same delivery arrives twice", async () => {
    await seedAcademy();
    await request(app).post("/v1/payout-account").send(ONBOARDING_FORM);

    const send = () =>
      request(app)
        .post("/v1/webhooks/asaas")
        .set("asaas-access-token", WEBHOOK_TOKEN)
        .send(accountStatusEvent());

    expect((await send()).status).toBe(200);
    const first = await request(app).get("/v1/payout-account");
    expect((await send()).status).toBe(200);
    const second = await request(app).get("/v1/payout-account");

    expect(second.body.account.status).toBe("approved");
    expect(second.body.account.approvedAt).toBe(first.body.account.approvedAt);
  });

  it("accepts an account-status delivery for an account it does not know", async () => {
    await seedAcademy();

    const unknown = await request(app)
      .post("/v1/webhooks/asaas")
      .set("asaas-access-token", WEBHOOK_TOKEN)
      .send(accountStatusEvent({ account: { id: "acc_someone_else", ownerId: null } }));

    // 200, or Asaas retries for days against an account that is not ours.
    expect(unknown.status).toBe(200);
  });

  it("serves the normalized fees the plan screen prices against", async () => {
    await seedAcademy();

    const fees = await request(app).get("/v1/payout-account/fees");

    expect(fees.status).toBe(200);
    expect(fees.body).toMatchObject({
      pix: { fixedFee: 1.99, monthlyFreeCredits: 10, freeCreditsUsed: 2 },
      creditCard: { operationFee: 0.49, percentage: 2.99, daysToReceive: 30 },
    });
  });

  it("keeps a student out of a plan whose academy cannot receive", async () => {
    const academyId = await seedAcademy();

    // A plan that predates the payout account, inserted the only way it can
    // exist: before the gate could refuse it.
    await request(app).post("/v1/payout-account").send(ONBOARDING_FORM);
    await request(app)
      .post("/v1/webhooks/asaas")
      .set("asaas-access-token", WEBHOOK_TOKEN)
      .send(accountStatusEvent());
    const plan = await request(app).post("/v1/subscriptions/plans").send({
      name: "Mensal",
      recurrenceMonths: 1,
      priceCents: 15_000,
      weeklyCheckinLimit: null,
    });
    expect(plan.status).toBe(201);

    // The account is then suspended.
    await request(app)
      .post("/v1/webhooks/asaas")
      .set("asaas-access-token", WEBHOOK_TOKEN)
      .send(
        accountStatusEvent({
          event: "ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING",
          accountStatus: {
            id: "sta_1",
            commercialInfo: "APPROVED",
            bankAccountInfo: "APPROVED",
            documentation: "APPROVED",
            general: "PENDING",
          },
        }),
      );

    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");
    asClerkUser(CLERK_STUDENT);
    const join = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${join.body.id}/approve`);

    asClerkUser(CLERK_STUDENT);
    const enroll = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId: plan.body.id });

    expect(enroll.status).toBe(403);
  });
});
