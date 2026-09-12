import { randomBytes, randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptSecret } from "../../lib/crypto.js";
import { HttpError } from "../../lib/http-error.js";
import { makeAcademy } from "../../testing/factories/index.js";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import { InMemoryPayoutAccountRepository } from "./payout-account.repository.in-memory.js";
import { PayoutAccountService } from "./payout-account.service.js";

const VALID_INPUT = {
  name: "Academia Tatame",
  email: "dono@academia.com.br",
  cpfCnpj: "12345678000199",
  companyType: "LIMITED" as const,
  mobilePhone: "11999999999",
  incomeValue: 5000,
  address: "Rua das Flores",
  addressNumber: "100",
  province: "Centro",
  postalCode: "01001000",
};

function setup(opts: { existingAccount?: boolean } = {}) {
  const managerId = randomUUID();
  const academy = makeAcademy({ ownerId: managerId });
  const academyRepo = new InMemoryAcademyRepository([academy]);
  const repo = new InMemoryPayoutAccountRepository();

  const createAccount = vi.fn().mockResolvedValue({
    id: "acc_123",
    walletId: "wal_456",
    apiKey: "$aact_subaccount_key",
  });
  const asaas = {
    root: () => ({ createAccount }) as never,
    forSubaccount: () => ({}) as never,
  };

  const svc = new PayoutAccountService(repo, academyRepo, asaas);

  if (opts.existingAccount) {
    void repo.create({
      academyId: academy.id,
      externalAccountId: "acc_old",
      walletId: "wal_old",
      apiKeyEncrypted: "sealed",
      status: "pending",
    });
  }

  return { svc, repo, academyRepo, managerId, academy, createAccount };
}

describe("PayoutAccountService.create", () => {
  const previous: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of [
      "PAYOUT_ACCOUNT_ENCRYPTION_KEY",
      "ASAAS_WEBHOOK_TOKEN",
      "API_PUBLIC_URL",
    ]) {
      previous[k] = process.env[k];
    }
    process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    process.env.ASAAS_WEBHOOK_TOKEN = "t".repeat(40);
    process.env.API_PUBLIC_URL = "https://api.tatame.app";
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("creates the Asaas subaccount and persists it as pending", async () => {
    const { svc, repo, managerId, academy, createAccount } = setup();

    const view = await svc.create(managerId, academy.id, VALID_INPUT);

    expect(createAccount).toHaveBeenCalledOnce();
    expect(view).toMatchObject({
      academyId: academy.id,
      externalAccountId: "acc_123",
      walletId: "wal_456",
      status: "pending",
    });
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]!.status).toBe("pending");
  });

  it("stores the Asaas api key encrypted, recoverable with the configured key", async () => {
    const { svc, repo, managerId, academy } = setup();
    await svc.create(managerId, academy.id, VALID_INPUT);

    const stored = repo.rows[0]!.apiKeyEncrypted;
    expect(stored).not.toContain("$aact_subaccount_key");
    expect(decryptSecret(stored)).toBe("$aact_subaccount_key");
  });

  it("never returns the api key in any form", async () => {
    const { svc, managerId, academy } = setup();
    const view = await svc.create(managerId, academy.id, VALID_INPUT);

    expect(JSON.stringify(view)).not.toContain("$aact_subaccount_key");
    expect(view).not.toHaveProperty("apiKey");
    expect(view).not.toHaveProperty("apiKeyEncrypted");
  });

  it("registers account-status and payment webhooks pointing at our endpoint", async () => {
    const { svc, managerId, academy, createAccount } = setup();
    await svc.create(managerId, academy.id, VALID_INPUT);

    const payload = createAccount.mock.calls[0]![0] as {
      webhooks: { url: string; authToken: string; events: string[]; apiVersion: number }[];
    };
    expect(payload.webhooks.length).toBeGreaterThan(0);
    for (const hook of payload.webhooks) {
      expect(hook.url).toBe("https://api.tatame.app/v1/webhooks/asaas");
      expect(hook.authToken).toBe("t".repeat(40));
      expect(hook.apiVersion).toBe(3);
    }
    const events = payload.webhooks.flatMap((h) => h.events);
    expect(events).toContain("ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED");
    expect(events).toContain("PAYMENT_RECEIVED");
  });

  it("forwards the registration data to Asaas unchanged", async () => {
    const { svc, managerId, academy, createAccount } = setup();
    await svc.create(managerId, academy.id, VALID_INPUT);

    expect(createAccount.mock.calls[0]![0]).toMatchObject(VALID_INPUT);
  });

  it("rejects a second account for the same academy with 409", async () => {
    const { svc, managerId, academy, createAccount } = setup({ existingAccount: true });

    const error = (await svc
      .create(managerId, academy.id, VALID_INPUT)
      .catch((e: unknown) => e)) as HttpError;

    expect(error).toBeInstanceOf(HttpError);
    expect(error.statusCode).toBe(409);
    expect(error.details).toMatchObject({ code: "PAYOUT_ACCOUNT_EXISTS" });
    // Nothing may reach Asaas — a second subaccount there is unrecoverable.
    expect(createAccount).not.toHaveBeenCalled();
  });

  it("turns a lost-response duplicate into 409 rather than a 500", async () => {
    const { svc, repo, managerId, academy } = setup();
    // The row appears between the pre-check and the insert, which is what a
    // retried request after a lost response looks like.
    vi.spyOn(repo, "create").mockRejectedValueOnce(
      new Error(
        'duplicate key value violates unique constraint "academy_payout_accounts_academy_id_unique"',
      ),
    );

    const error = (await svc
      .create(managerId, academy.id, VALID_INPUT)
      .catch((e: unknown) => e)) as HttpError;

    expect(error).toBeInstanceOf(HttpError);
    expect(error.statusCode).toBe(409);
  });

  it("persists nothing when Asaas rejects the data", async () => {
    const { svc, repo, managerId, academy, createAccount } = setup();
    createAccount.mockRejectedValueOnce(
      new HttpError(400, "O CEP informado é inválido.", { code: "invalid_postalCode" }),
    );

    const error = (await svc
      .create(managerId, academy.id, VALID_INPUT)
      .catch((e: unknown) => e)) as HttpError;

    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("O CEP informado é inválido.");
    expect(repo.rows).toHaveLength(0);
  });

  it("refuses a manager who does not own the academy", async () => {
    const { svc, academy, createAccount } = setup();

    const error = (await svc
      .create(randomUUID(), academy.id, VALID_INPUT)
      .catch((e: unknown) => e)) as HttpError;

    expect(error.statusCode).toBe(403);
    expect(createAccount).not.toHaveBeenCalled();
  });

  it("404s for an academy that does not exist", async () => {
    const { svc, managerId } = setup();
    const error = (await svc
      .create(managerId, randomUUID(), VALID_INPUT)
      .catch((e: unknown) => e)) as HttpError;
    expect(error.statusCode).toBe(404);
  });

  it("refuses to create when the webhook token is not configured", async () => {
    delete process.env.ASAAS_WEBHOOK_TOKEN;
    const { svc, managerId, academy, createAccount } = setup();

    const error = (await svc
      .create(managerId, academy.id, VALID_INPUT)
      .catch((e: unknown) => e)) as HttpError;

    expect(error.statusCode).toBe(503);
    expect(createAccount).not.toHaveBeenCalled();
  });

  it("refuses to create when the encryption key is not configured", async () => {
    delete process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY;
    const { svc, repo, managerId, academy } = setup();

    await expect(svc.create(managerId, academy.id, VALID_INPUT)).rejects.toThrow();
    // An account at Asaas whose key we cannot store is the unrecoverable case.
    expect(repo.rows).toHaveLength(0);
  });
});

describe("PayoutAccountService.get", () => {
  it("returns null when the academy has no account", async () => {
    const { svc, managerId, academy } = setup();
    expect(await svc.get(managerId, academy.id)).toBeNull();
  });

  it("returns the stored account without its api key", async () => {
    const { svc, managerId, academy } = setup({ existingAccount: true });
    const view = await svc.get(managerId, academy.id);
    expect(view).toMatchObject({ externalAccountId: "acc_old", status: "pending" });
    expect(view).not.toHaveProperty("apiKeyEncrypted");
  });

  it("refuses a manager who does not own the academy", async () => {
    const { svc, academy } = setup({ existingAccount: true });
    const error = (await svc.get(randomUUID(), academy.id).catch((e: unknown) => e)) as HttpError;
    expect(error.statusCode).toBe(403);
  });
});
