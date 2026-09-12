import { randomBytes, randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AsaasAccountStatus } from "../../lib/asaas.js";
import { encryptSecret } from "../../lib/crypto.js";
import type { HttpError } from "../../lib/http-error.js";
import { makeAcademy } from "../../testing/factories/index.js";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import { InMemoryPayoutAccountRepository } from "./payout-account.repository.in-memory.js";
import { PayoutAccountService } from "./payout-account.service.js";

const KEY = randomBytes(32).toString("hex");

function asaasStatus(overrides: Partial<AsaasAccountStatus> = {}): AsaasAccountStatus {
  return {
    id: "acc_1",
    commercialInfo: "PENDING",
    bankAccountInfo: "PENDING",
    documentation: "PENDING",
    general: "PENDING",
    ...overrides,
  };
}

function setup() {
  const managerId = randomUUID();
  const academy = makeAcademy({ ownerId: managerId });
  const academyRepo = new InMemoryAcademyRepository([academy]);
  const repo = new InMemoryPayoutAccountRepository();
  const getAccountStatus = vi.fn().mockResolvedValue(asaasStatus());
  const svc = new PayoutAccountService(repo, academyRepo, {
    root: () => ({}) as never,
    forSubaccount: () => ({ getAccountStatus }) as never,
  });
  return { svc, repo, managerId, academy, getAccountStatus };
}

async function seedAccount(
  repo: InMemoryPayoutAccountRepository,
  academyId: string,
  status: "pending" | "approved" = "pending",
) {
  return repo.create({
    academyId,
    externalAccountId: "acc_1",
    walletId: "wal_1",
    apiKeyEncrypted: encryptSecret("$aact_sub"),
    status,
  });
}

describe("PayoutAccountService.refreshStatus", () => {
  const previous: Record<string, string | undefined> = {};

  beforeEach(() => {
    previous.PAYOUT_ACCOUNT_ENCRYPTION_KEY = process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY;
    process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY = KEY;
  });

  afterEach(() => {
    const v = previous.PAYOUT_ACCOUNT_ENCRYPTION_KEY;
    if (v === undefined) delete process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY;
    else process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY = v;
  });

  it("reads the live status from Asaas rather than trusting the stored row", async () => {
    const { svc, repo, managerId, academy, getAccountStatus } = setup();
    await seedAccount(repo, academy.id);

    await svc.refreshStatus(managerId, academy.id);

    expect(getAccountStatus).toHaveBeenCalledOnce();
  });

  it("stores each Asaas area verbatim alongside the derived status", async () => {
    const { svc, repo, managerId, academy, getAccountStatus } = setup();
    await seedAccount(repo, academy.id);
    getAccountStatus.mockResolvedValueOnce(
      asaasStatus({
        general: "AWAITING_APPROVAL",
        documentation: "APPROVED",
        commercialInfo: "AWAITING_APPROVAL",
        bankAccountInfo: "APPROVED",
      }),
    );

    const view = await svc.refreshStatus(managerId, academy.id);

    expect(view.status).toBe("under_review");
    expect(view.generalStatus).toBe("AWAITING_APPROVAL");
    expect(view.documentStatus).toBe("APPROVED");
    expect(view.commercialInfoStatus).toBe("AWAITING_APPROVAL");
    expect(view.bankAccountInfoStatus).toBe("APPROVED");
  });

  it("stamps approvedAt the first time the account is approved", async () => {
    const { svc, repo, managerId, academy, getAccountStatus } = setup();
    await seedAccount(repo, academy.id);
    getAccountStatus.mockResolvedValue(asaasStatus({ general: "APPROVED" }));

    const view = await svc.refreshStatus(managerId, academy.id);

    expect(view.status).toBe("approved");
    expect(view.approvedAt).toBeInstanceOf(Date);
  });

  it("keeps the original approvedAt across later refreshes", async () => {
    const { svc, repo, managerId, academy, getAccountStatus } = setup();
    await seedAccount(repo, academy.id);
    getAccountStatus.mockResolvedValue(asaasStatus({ general: "APPROVED" }));

    const first = await svc.refreshStatus(managerId, academy.id);
    const second = await svc.refreshStatus(managerId, academy.id);

    expect(second.approvedAt).toEqual(first.approvedAt);
  });

  it("marks a previously approved account suspended when approval is lost", async () => {
    const { svc, repo, managerId, academy, getAccountStatus } = setup();
    await seedAccount(repo, academy.id, "approved");
    getAccountStatus.mockResolvedValueOnce(asaasStatus({ general: "PENDING" }));

    const view = await svc.refreshStatus(managerId, academy.id);

    expect(view.status).toBe("suspended");
  });

  it("never returns the stored api key", async () => {
    const { svc, repo, managerId, academy } = setup();
    await seedAccount(repo, academy.id);
    const view = await svc.refreshStatus(managerId, academy.id);
    expect(view).not.toHaveProperty("apiKeyEncrypted");
  });

  it("404s when the academy has no payout account", async () => {
    const { svc, managerId, academy } = setup();
    const error = (await svc
      .refreshStatus(managerId, academy.id)
      .catch((e: unknown) => e)) as HttpError;
    expect(error.statusCode).toBe(404);
  });

  it("refuses a manager who does not own the academy", async () => {
    const { svc, repo, academy, getAccountStatus } = setup();
    await seedAccount(repo, academy.id);
    const error = (await svc
      .refreshStatus(randomUUID(), academy.id)
      .catch((e: unknown) => e)) as HttpError;
    expect(error.statusCode).toBe(403);
    expect(getAccountStatus).not.toHaveBeenCalled();
  });
});
