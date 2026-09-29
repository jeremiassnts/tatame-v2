import { randomBytes, randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptSecret } from "../../lib/crypto.js";
import { HttpError } from "../../lib/http-error.js";
import { makeAcademy } from "../../testing/factories/index.js";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import { InMemoryPayoutAccountRepository } from "./payout-account.repository.in-memory.js";
import { PayoutAccountService } from "./payout-account.service.js";

const KEY = randomBytes(32).toString("hex");

const UPLOADABLE_GROUP = {
  id: "grp_upload",
  status: "NOT_SENT",
  type: "IDENTIFICATION",
  title: "Documento de identificação",
  description: "Envie o RG ou a CNH",
  onboardingUrl: null,
  documents: [],
};

const LINK_ONLY_GROUP = {
  id: "grp_link",
  status: "PENDING",
  type: "CUSTOM",
  title: "Contrato social",
  description: "Finalize pelo link",
  onboardingUrl: "https://onboarding.asaas.com/abc",
  documents: [],
};

function setup() {
  const managerId = randomUUID();
  const academy = makeAcademy({ ownerId: managerId });
  const academyRepo = new InMemoryAcademyRepository([academy]);
  const repo = new InMemoryPayoutAccountRepository();

  const listDocuments = vi.fn().mockResolvedValue({
    rejectReasons: null,
    data: [UPLOADABLE_GROUP, LINK_ONLY_GROUP],
  });
  const uploadDocument = vi.fn().mockResolvedValue({ id: "doc_1", status: "PENDING" });
  const forSubaccount = vi.fn().mockReturnValue({ listDocuments, uploadDocument });

  const svc = new PayoutAccountService(repo, academyRepo, {
    root: () => ({}) as never,
    forSubaccount: forSubaccount as never,
  });

  return { svc, repo, managerId, academy, listDocuments, uploadDocument, forSubaccount };
}

async function seedAccount(
  repo: InMemoryPayoutAccountRepository,
  academyId: string,
  apiKey = "$aact_sub",
) {
  return repo.create({
    academyId,
    externalAccountId: "acc_1",
    walletId: "wal_1",
    apiKeyEncrypted: encryptSecret(apiKey),
    status: "pending",
  });
}

describe("PayoutAccountService documents", () => {
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

  describe("listDocuments", () => {
    it("acts as the subaccount, using the decrypted key", async () => {
      const { svc, repo, managerId, academy, forSubaccount } = setup();
      await seedAccount(repo, academy.id, "$aact_the_key");

      await svc.listDocuments(managerId, academy.id);

      expect(forSubaccount).toHaveBeenCalledWith("$aact_the_key");
    });

    it("marks which groups can be uploaded in-app and which cannot", async () => {
      const { svc, repo, managerId, academy } = setup();
      await seedAccount(repo, academy.id);

      const result = await svc.listDocuments(managerId, academy.id);

      expect(result.groups).toHaveLength(2);
      expect(result.groups[0]).toMatchObject({
        id: "grp_upload",
        canUploadInApp: true,
        onboardingUrl: null,
      });
      expect(result.groups[1]).toMatchObject({
        id: "grp_link",
        canUploadInApp: false,
        onboardingUrl: "https://onboarding.asaas.com/abc",
      });
    });

    /*
      The payload a real sandbox subaccount answers with, pinned verbatim: Asaas
      omits `documents` altogether for a group nothing was uploaded to, and adds
      a `responsible` object our type never declared. Every other fixture here
      carries `documents: []`, which is exactly why the mobile card crashed on
      `group.documents.length` against the real API and never against this suite.
    */
    it("defaults documents to an empty list when Asaas omits the field", async () => {
      const { svc, repo, managerId, academy, listDocuments } = setup();
      await seedAccount(repo, academy.id);
      listDocuments.mockResolvedValue({
        rejectReasons: null,
        data: [
          {
            id: "00000000-0000-0000-0000-000000000000",
            status: "APPROVED",
            type: "IDENTIFICATION",
            title: "Documentos de identificação",
            description:
              "Para enviar esse documento acesse nosso aplicativo ou utilize o link de onboarding.",
            responsible: { name: "Fighter's BJJ", type: "ASAAS_ACCOUNT_OWNER" },
            onboardingUrl: null,
          },
        ],
      });

      const result = await svc.listDocuments(managerId, academy.id);

      expect(result.groups[0]!.documents).toEqual([]);
    });

    it("stores the onboarding url so the dashboard can route without a round trip", async () => {
      const { svc, repo, managerId, academy } = setup();
      await seedAccount(repo, academy.id);

      await svc.listDocuments(managerId, academy.id);

      expect(repo.rows[0]!.onboardingUrl).toBe("https://onboarding.asaas.com/abc");
    });

    it("clears a stored onboarding url once no group needs the link", async () => {
      const { svc, repo, managerId, academy, listDocuments } = setup();
      const row = await seedAccount(repo, academy.id);
      await repo.update(row.id, { onboardingUrl: "https://onboarding.asaas.com/old" });
      listDocuments.mockResolvedValueOnce({ rejectReasons: null, data: [UPLOADABLE_GROUP] });

      await svc.listDocuments(managerId, academy.id);

      expect(repo.rows[0]!.onboardingUrl).toBeNull();
    });

    it("surfaces the Asaas rejection reason", async () => {
      const { svc, repo, managerId, academy, listDocuments } = setup();
      await seedAccount(repo, academy.id);
      listDocuments.mockResolvedValueOnce({
        rejectReasons: "Documento ilegível",
        data: [UPLOADABLE_GROUP],
      });

      const result = await svc.listDocuments(managerId, academy.id);

      expect(result.rejectReasons).toBe("Documento ilegível");
      expect(repo.rows[0]!.rejectionReason).toBe("Documento ilegível");
    });

    it("404s when the academy has no payout account", async () => {
      const { svc, managerId, academy } = setup();
      const error = (await svc
        .listDocuments(managerId, academy.id)
        .catch((e: unknown) => e)) as HttpError;
      expect(error.statusCode).toBe(404);
      expect(error.details).toMatchObject({ code: "PAYOUT_ACCOUNT_REQUIRED" });
    });

    it("refuses a manager who does not own the academy", async () => {
      const { svc, repo, academy, forSubaccount } = setup();
      await seedAccount(repo, academy.id);
      const error = (await svc
        .listDocuments(randomUUID(), academy.id)
        .catch((e: unknown) => e)) as HttpError;
      expect(error.statusCode).toBe(403);
      expect(forSubaccount).not.toHaveBeenCalled();
    });

    it("fails loudly when the stored key cannot be decrypted", async () => {
      const { svc, repo, managerId, academy, forSubaccount } = setup();
      await seedAccount(repo, academy.id);
      process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY = randomBytes(32).toString("hex");

      await expect(svc.listDocuments(managerId, academy.id)).rejects.toThrow();
      expect(forSubaccount).not.toHaveBeenCalled();
    });
  });

  describe("uploadDocument", () => {
    const file = {
      buffer: Buffer.from("pdf"),
      filename: "rg.pdf",
      contentType: "application/pdf",
    };

    it("uploads to a group Asaas accepts uploads for", async () => {
      const { svc, repo, managerId, academy, uploadDocument } = setup();
      await seedAccount(repo, academy.id);

      const result = await svc.uploadDocument(managerId, academy.id, "grp_upload", {
        type: "IDENTIFICATION",
        file,
      });

      expect(uploadDocument).toHaveBeenCalledWith("grp_upload", {
        type: "IDENTIFICATION",
        file,
      });
      expect(result).toEqual({ id: "doc_1", status: "PENDING" });
    });

    it("refuses to upload to a group that carries an onboarding url", async () => {
      const { svc, repo, managerId, academy, uploadDocument } = setup();
      await seedAccount(repo, academy.id);

      const error = (await svc
        .uploadDocument(managerId, academy.id, "grp_link", { type: "CUSTOM", file })
        .catch((e: unknown) => e)) as HttpError;

      expect(error.statusCode).toBe(409);
      expect(error.details).toMatchObject({
        code: "DOCUMENT_REQUIRES_ONBOARDING_URL",
        onboardingUrl: "https://onboarding.asaas.com/abc",
      });
      // Asaas rejects these outright; sending it anyway only wastes a call.
      expect(uploadDocument).not.toHaveBeenCalled();
    });

    it("404s for a group Asaas does not list", async () => {
      const { svc, repo, managerId, academy, uploadDocument } = setup();
      await seedAccount(repo, academy.id);

      const error = (await svc
        .uploadDocument(managerId, academy.id, "grp_missing", { type: "CUSTOM", file })
        .catch((e: unknown) => e)) as HttpError;

      expect(error.statusCode).toBe(404);
      expect(uploadDocument).not.toHaveBeenCalled();
    });

    it("404s when the academy has no payout account", async () => {
      const { svc, managerId, academy } = setup();
      const error = (await svc
        .uploadDocument(managerId, academy.id, "grp_upload", { type: "CUSTOM", file })
        .catch((e: unknown) => e)) as HttpError;
      expect(error.statusCode).toBe(404);
    });

    it("refuses a manager who does not own the academy", async () => {
      const { svc, repo, academy, uploadDocument } = setup();
      await seedAccount(repo, academy.id);
      const error = (await svc
        .uploadDocument(randomUUID(), academy.id, "grp_upload", { type: "CUSTOM", file })
        .catch((e: unknown) => e)) as HttpError;
      expect(error.statusCode).toBe(403);
      expect(uploadDocument).not.toHaveBeenCalled();
    });
  });
});
