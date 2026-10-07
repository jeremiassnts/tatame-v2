import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../lib/http-error.js";
import { InMemoryUserRepository } from "../user/user.repository.in-memory.js";
import { AsaasCustomerService } from "./asaas-customer.service.js";

const CPF = "41763193640";

function makeAsaas(overrides: {
  createCustomer?: ReturnType<typeof vi.fn>;
  findCustomerByExternalReference?: ReturnType<typeof vi.fn>;
}) {
  const client = {
    createCustomer:
      overrides.createCustomer ??
      vi.fn().mockResolvedValue({
        id: "cus_created",
        name: "Aluno",
        cpfCnpj: CPF,
      }),
    findCustomerByExternalReference:
      overrides.findCustomerByExternalReference ??
      vi.fn().mockResolvedValue(undefined),
  };
  return { factory: { root: () => client as never }, client };
}

describe("AsaasCustomerService", () => {
  let userRepo: InMemoryUserRepository;
  let userId: string;

  beforeEach(async () => {
    userRepo = new InMemoryUserRepository();
    await userRepo.upsert({
      clerkUserId: "user_student",
      email: "aluno@example.com",
      name: "Aluno Teste",
      profileImageUrl: null,
    });
    const user = await userRepo.findByClerkId("user_student");
    userId = user!.id;
  });

  it("reuses the stored customer without asking Asaas anything", async () => {
    await userRepo.updateAsaasCustomerId(userId, "cus_stored");
    const { factory, client } = makeAsaas({});

    const service = new AsaasCustomerService(userRepo, factory);
    expect(await service.ensureCustomer(userId, { cpfCnpj: CPF })).toBe(
      "cus_stored",
    );

    expect(client.findCustomerByExternalReference).not.toHaveBeenCalled();
    expect(client.createCustomer).not.toHaveBeenCalled();
  });

  it("creates the customer and persists the id", async () => {
    const { factory, client } = makeAsaas({});
    const service = new AsaasCustomerService(userRepo, factory);

    expect(await service.ensureCustomer(userId, { cpfCnpj: CPF })).toBe(
      "cus_created",
    );

    expect(client.createCustomer).toHaveBeenCalledWith({
      name: "Aluno Teste",
      email: "aluno@example.com",
      cpfCnpj: CPF,
      externalReference: userId,
      notificationDisabled: true,
    });

    // Persisted, so the next charge never asks for the document again.
    const reread = await userRepo.findById(userId);
    expect(reread?.asaasCustomerId).toBe("cus_created");
  });

  it("recovers a customer whose id we failed to store, without creating a second", async () => {
    const { factory, client } = makeAsaas({
      findCustomerByExternalReference: vi.fn().mockResolvedValue({
        id: "cus_orphan",
        name: "Aluno Teste",
        cpfCnpj: CPF,
      }),
    });
    const service = new AsaasCustomerService(userRepo, factory);

    expect(await service.ensureCustomer(userId, {})).toBe("cus_orphan");

    expect(client.findCustomerByExternalReference).toHaveBeenCalledWith(userId);
    expect(client.createCustomer).not.toHaveBeenCalled();
    expect((await userRepo.findById(userId))?.asaasCustomerId).toBe(
      "cus_orphan",
    );
  });

  it("asks for the document only when it actually has to create the customer", async () => {
    const { factory, client } = makeAsaas({});
    const service = new AsaasCustomerService(userRepo, factory);

    await expect(service.ensureCustomer(userId, {})).rejects.toMatchObject({
      statusCode: 400,
      details: { code: "CPF_REQUIRED" },
    });
    expect(client.createCustomer).not.toHaveBeenCalled();
  });

  it("treats a blank document as no document", async () => {
    const { factory } = makeAsaas({});
    const service = new AsaasCustomerService(userRepo, factory);

    await expect(
      service.ensureCustomer(userId, { cpfCnpj: "   " }),
    ).rejects.toMatchObject({ details: { code: "CPF_REQUIRED" } });
  });

  it("strips the punctuation a form sends", async () => {
    const { factory, client } = makeAsaas({});
    const service = new AsaasCustomerService(userRepo, factory);

    await service.ensureCustomer(userId, { cpfCnpj: "417.631.936-40" });

    expect(client.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ cpfCnpj: CPF }),
    );
  });

  it("404s on a user that does not exist", async () => {
    const { factory } = makeAsaas({});
    const service = new AsaasCustomerService(userRepo, factory);

    await expect(
      service.ensureCustomer("00000000-0000-0000-0000-000000000000", {
        cpfCnpj: CPF,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  // Asaas writes its validation messages in Portuguese and they are better than
  // anything this layer could invent — an invalid CPF has to reach the screen.
  it("lets an Asaas rejection through untouched", async () => {
    const { factory } = makeAsaas({
      createCustomer: vi
        .fn()
        .mockRejectedValue(new HttpError(400, "CPF ou CNPJ inválido")),
    });
    const service = new AsaasCustomerService(userRepo, factory);

    await expect(
      service.ensureCustomer(userId, { cpfCnpj: "111" }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "CPF ou CNPJ inválido",
    });
  });

  it("does not store a customer id when Asaas failed", async () => {
    const { factory } = makeAsaas({
      createCustomer: vi
        .fn()
        .mockRejectedValue(new HttpError(502, "Asaas está indisponível")),
    });
    const service = new AsaasCustomerService(userRepo, factory);

    await expect(
      service.ensureCustomer(userId, { cpfCnpj: CPF }),
    ).rejects.toMatchObject({ statusCode: 502 });
    expect((await userRepo.findById(userId))?.asaasCustomerId).toBeNull();
  });
});
