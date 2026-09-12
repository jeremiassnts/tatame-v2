import { randomBytes, randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptSecret } from "../../lib/crypto.js";
import { makeAcademy } from "../../testing/factories/index.js";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import {
  AsaasAccountWebhookHandler,
  type AsaasAccountStatusEvent,
} from "./asaas-account-webhook.handler.js";
import { InMemoryPayoutAccountRepository } from "./payout-account.repository.in-memory.js";
import { PayoutAccountService } from "./payout-account.service.js";

const KEY = randomBytes(32).toString("hex");

function event(
  overrides: Partial<AsaasAccountStatusEvent> = {},
): AsaasAccountStatusEvent {
  return {
    id: "evt_1",
    event: "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED",
    dateCreated: "2026-09-12 10:00:00",
    account: { id: "acc_1", ownerId: null },
    accountStatus: {
      id: "sta_1",
      commercialInfo: "APPROVED",
      bankAccountInfo: "APPROVED",
      documentation: "APPROVED",
      general: "APPROVED",
    },
    ...overrides,
  } satisfies AsaasAccountStatusEvent;
}

async function setup(opts: { status?: "pending" | "approved" } = {}) {
  const academy = makeAcademy({ ownerId: randomUUID() });
  const repo = new InMemoryPayoutAccountRepository();
  const service = new PayoutAccountService(
    repo,
    new InMemoryAcademyRepository([academy]),
    { root: () => ({}) as never, forSubaccount: () => ({}) as never },
  );
  await repo.create({
    academyId: academy.id,
    externalAccountId: "acc_1",
    walletId: "wal_1",
    apiKeyEncrypted: encryptSecret("$aact_sub"),
    status: opts.status ?? "pending",
  });
  return { handler: new AsaasAccountWebhookHandler(repo, service), repo, academy };
}

describe("AsaasAccountWebhookHandler", () => {
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

  it("approves the account and stamps approvedAt on general approval", async () => {
    const { handler, repo } = await setup();

    await handler.handleEvent(event());

    expect(repo.rows[0]!.status).toBe("approved");
    expect(repo.rows[0]!.approvedAt).toBeInstanceOf(Date);
  });

  it("stores every area the event reports", async () => {
    const { handler, repo } = await setup();

    await handler.handleEvent(
      event({
        event: "ACCOUNT_STATUS_DOCUMENT_PENDING",
        accountStatus: {
          id: "sta_1",
          commercialInfo: "APPROVED",
          bankAccountInfo: "AWAITING_APPROVAL",
          documentation: "PENDING",
          general: "PENDING",
        },
      }),
    );

    const row = repo.rows[0]!;
    expect(row.status).toBe("awaiting_documents");
    expect(row.documentStatus).toBe("PENDING");
    expect(row.bankAccountInfoStatus).toBe("AWAITING_APPROVAL");
    expect(row.generalStatus).toBe("PENDING");
  });

  it("records a rejection with its status", async () => {
    const { handler, repo } = await setup();

    await handler.handleEvent(
      event({
        event: "ACCOUNT_STATUS_DOCUMENT_REJECTED",
        accountStatus: {
          id: "sta_1",
          commercialInfo: "APPROVED",
          bankAccountInfo: "APPROVED",
          documentation: "REJECTED",
          general: "PENDING",
        },
      }),
    );

    expect(repo.rows[0]!.status).toBe("rejected");
  });

  it("suspends an account that loses its approval", async () => {
    const { handler, repo } = await setup({ status: "approved" });

    await handler.handleEvent(
      event({
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

    expect(repo.rows[0]!.status).toBe("suspended");
  });

  it("is idempotent — the same delivery twice leaves one approval", async () => {
    const { handler, repo } = await setup();

    await handler.handleEvent(event());
    const firstApprovedAt = repo.rows[0]!.approvedAt;
    await handler.handleEvent(event());

    expect(repo.rows[0]!.status).toBe("approved");
    expect(repo.rows[0]!.approvedAt).toEqual(firstApprovedAt);
  });

  it("reports an event for an account it does not know", async () => {
    const { handler, repo } = await setup();

    await handler.handleEvent(event({ account: { id: "acc_unknown", ownerId: null } }));

    expect(repo.rows[0]!.status).toBe("pending");
  });

  it("reports an event type it does not handle", async () => {
    const { handler, repo } = await setup();

    await handler.handleEvent(event({ event: "PAYMENT_RECEIVED" }));

    expect(repo.rows[0]!.status).toBe("pending");
  });

  it("reports an event with no accountStatus rather than writing nulls", async () => {
    const { handler, repo } = await setup();

    await handler.handleEvent(event({ accountStatus: undefined }));

    expect(repo.rows[0]!.status).toBe("pending");
    expect(repo.rows[0]!.generalStatus).toBeNull();
  });

  it("reports an event with no account id", async () => {
    const { handler, repo } = await setup();
    await handler.handleEvent(event({ account: undefined }));
    expect(repo.rows[0]!.status).toBe("pending");
  });

  it("does not swallow a repository failure", async () => {
    const { handler, repo } = await setup();
    vi.spyOn(repo, "update").mockRejectedValueOnce(new Error("db down"));

    await expect(handler.handleEvent(event())).rejects.toThrow("db down");
  });
});
