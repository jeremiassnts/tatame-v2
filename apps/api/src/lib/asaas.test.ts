import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "./http-error.js";
import { AsaasClient } from "./asaas.js";

const BASE_URL = "https://api-sandbox.asaas.com";
const ROOT_KEY = "$aact_root_key";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("AsaasClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const previous: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ["ASAAS_API_KEY", "ASAAS_BASE_URL"]) previous[k] = process.env[k];
    process.env.ASAAS_API_KEY = ROOT_KEY;
    process.env.ASAAS_BASE_URL = BASE_URL;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });

  describe("construction", () => {
    it("root() sends the root key as access_token", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: "acc", commercialInfo: "APPROVED", bankAccountInfo: "APPROVED", documentation: "APPROVED", general: "APPROVED" }));
      await AsaasClient.root().getAccountStatus();

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/v3/myAccount/status`);
      expect((init.headers as Record<string, string>).access_token).toBe(ROOT_KEY);
    });

    it("forSubaccount() sends the subaccount key instead of the root key", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { data: [] }));
      await AsaasClient.forSubaccount("$aact_sub_key").listDocuments();

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>).access_token).toBe("$aact_sub_key");
    });

    it("root() throws when ASAAS_API_KEY is not configured", () => {
      delete process.env.ASAAS_API_KEY;
      expect(() => AsaasClient.root()).toThrow(/ASAAS_API_KEY/);
    });

    it("root() throws when ASAAS_BASE_URL is not configured", () => {
      delete process.env.ASAAS_BASE_URL;
      expect(() => AsaasClient.root()).toThrow(/ASAAS_BASE_URL/);
    });

    it("tolerates a base URL with a trailing slash", async () => {
      process.env.ASAAS_BASE_URL = `${BASE_URL}/`;
      fetchMock.mockResolvedValue(jsonResponse(200, { data: [] }));
      await AsaasClient.root().listDocuments();
      expect(fetchMock.mock.calls[0]![0]).toBe(`${BASE_URL}/v3/myAccount/documents`);
    });
  });

  describe("createAccount", () => {
    const input = {
      name: "Academia Tatame",
      email: "dono@academia.com.br",
      cpfCnpj: "12345678000199",
      mobilePhone: "11999999999",
      incomeValue: 5000,
      address: "Rua das Flores",
      addressNumber: "100",
      province: "Centro",
      postalCode: "01001000",
    };

    it("POSTs to /v3/accounts and returns id, walletId and apiKey", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, {
          id: "acc_123",
          walletId: "wal_456",
          accessToken: { apiKey: "$aact_sub_789" },
        }),
      );

      const account = await AsaasClient.root().createAccount(input);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/v3/accounts`);
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toMatchObject({ cpfCnpj: "12345678000199" });
      expect(account).toMatchObject({ id: "acc_123", walletId: "wal_456", apiKey: "$aact_sub_789" });
    });

    it("accepts a top-level apiKey as well, since losing it is unrecoverable", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { id: "acc_1", walletId: "wal_1", apiKey: "$aact_top" }),
      );
      const account = await AsaasClient.root().createAccount(input);
      expect(account.apiKey).toBe("$aact_top");
    });

    it("throws when the response carries no api key at all", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: "acc_1", walletId: "wal_1" }));
      await expect(AsaasClient.root().createAccount(input)).rejects.toThrow(/chave de API/i);
    });

    it("throws when the response carries no walletId", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { id: "acc_1", accessToken: { apiKey: "k" } }),
      );
      await expect(AsaasClient.root().createAccount(input)).rejects.toThrow(/walletId/i);
    });

    it("omits undefined optional fields from the request body", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { id: "a", walletId: "w", accessToken: { apiKey: "k" } }),
      );
      await AsaasClient.root().createAccount(input);
      const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string) as Record<string, unknown>;
      expect(body).not.toHaveProperty("birthDate");
      expect(body).not.toHaveProperty("companyType");
    });
  });

  describe("error mapping", () => {
    it("surfaces an Asaas 400 description verbatim as a 400", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(400, {
          errors: [{ code: "invalid_cpfCnpj", description: "O CPF/CNPJ informado é inválido." }],
        }),
      );

      const error = await AsaasClient.root().getFees().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).statusCode).toBe(400);
      expect((error as HttpError).message).toBe("O CPF/CNPJ informado é inválido.");
      expect((error as HttpError).details).toMatchObject({ code: "invalid_cpfCnpj" });
    });

    it("joins several Asaas validation messages", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(400, {
          errors: [
            { code: "invalid_postalCode", description: "CEP inválido." },
            { code: "invalid_mobilePhone", description: "Celular inválido." },
          ],
        }),
      );
      const error = (await AsaasClient.root().getFees().catch((e: unknown) => e)) as HttpError;
      expect(error.message).toBe("CEP inválido. Celular inválido.");
    });

    it("maps an Asaas 401 to 502 — a bad key is our problem, not the caller's", async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, { errors: [{ code: "unauthorized", description: "Chave inválida" }] }));
      const error = (await AsaasClient.root().getFees().catch((e: unknown) => e)) as HttpError;
      expect(error.statusCode).toBe(502);
    });

    it("maps an Asaas 403 to 502", async () => {
      fetchMock.mockResolvedValue(jsonResponse(403, { errors: [] }));
      const error = (await AsaasClient.root().getFees().catch((e: unknown) => e)) as HttpError;
      expect(error.statusCode).toBe(502);
    });

    it("maps an Asaas 404 to 404", async () => {
      fetchMock.mockResolvedValue(jsonResponse(404, { errors: [{ code: "not_found", description: "Não encontrado" }] }));
      const error = (await AsaasClient.root().getFees().catch((e: unknown) => e)) as HttpError;
      expect(error.statusCode).toBe(404);
    });

    it("maps rate limiting to 503", async () => {
      fetchMock.mockResolvedValue(jsonResponse(429, { errors: [] }));
      const error = (await AsaasClient.root().getFees().catch((e: unknown) => e)) as HttpError;
      expect(error.statusCode).toBe(503);
    });

    it("maps an Asaas 5xx to 502", async () => {
      fetchMock.mockResolvedValue(jsonResponse(500, { errors: [] }));
      const error = (await AsaasClient.root().getFees().catch((e: unknown) => e)) as HttpError;
      expect(error.statusCode).toBe(502);
    });

    it("maps a network failure to 502 without leaking the cause", async () => {
      fetchMock.mockRejectedValue(new Error("ECONNREFUSED 1.2.3.4:443"));
      const error = (await AsaasClient.root().getFees().catch((e: unknown) => e)) as HttpError;
      expect(error).toBeInstanceOf(HttpError);
      expect(error.statusCode).toBe(502);
      expect(error.message).not.toContain("ECONNREFUSED");
    });

    it("maps a non-JSON body to 502 rather than throwing a parse error", async () => {
      fetchMock.mockResolvedValue(new Response("<html>gateway timeout</html>", { status: 504 }));
      const error = (await AsaasClient.root().getFees().catch((e: unknown) => e)) as HttpError;
      expect(error.statusCode).toBe(502);
    });

    it("never puts the access token in the error details", async () => {
      fetchMock.mockResolvedValue(jsonResponse(400, { errors: [{ code: "x", description: "y" }] }));
      const error = (await AsaasClient.root().getFees().catch((e: unknown) => e)) as HttpError;
      expect(JSON.stringify(error.details ?? {})).not.toContain(ROOT_KEY);
    });
  });

  describe("documents", () => {
    it("lists document groups", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, {
          rejectReasons: null,
          data: [
            { id: "grp_1", status: "PENDING", type: "IDENTIFICATION", title: "Identidade", description: "Envie seu RG", onboardingUrl: null, documents: [] },
            { id: "grp_2", status: "NOT_SENT", type: "CUSTOM", title: "Contrato", description: "", onboardingUrl: "https://onboarding.asaas.com/x", documents: [] },
          ],
        }),
      );

      const result = await AsaasClient.forSubaccount("k").listDocuments();
      expect(fetchMock.mock.calls[0]![0]).toBe(`${BASE_URL}/v3/myAccount/documents`);
      expect(result.data).toHaveLength(2);
      expect(result.data[1]!.onboardingUrl).toBe("https://onboarding.asaas.com/x");
    });
  });

  describe("status and fees", () => {
    it("reads the account status", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { id: "acc", commercialInfo: "APPROVED", bankAccountInfo: "PENDING", documentation: "AWAITING_APPROVAL", general: "PENDING" }),
      );
      const status = await AsaasClient.forSubaccount("k").getAccountStatus();
      expect(status).toEqual({ id: "acc", commercialInfo: "APPROVED", bankAccountInfo: "PENDING", documentation: "AWAITING_APPROVAL", general: "PENDING" });
    });

    it("reads the account fees", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, {
          payment: {
            pix: { fixedFeeValue: 1.99, percentageFee: 0, minimumFeeValue: 0, maximumFeeValue: 0, monthlyCreditsWithoutFee: 10, creditsReceivedOfCurrentMonth: 3 },
            creditCard: { operationValue: 0.49, oneInstallmentPercentage: 2.99, daysToReceive: 30 },
          },
        }),
      );
      const fees = await AsaasClient.root().getFees();
      expect(fetchMock.mock.calls[0]![0]).toBe(`${BASE_URL}/v3/myAccount/fees`);
      expect(fees.payment.pix.fixedFeeValue).toBe(1.99);
      expect(fees.payment.creditCard.daysToReceive).toBe(30);
    });
  });

  describe("customers", () => {
    // The payload pinned here is the sandbox's own answer on 2026-09-29, down
    // to the nulls it fills every unsent field with.
    const SANDBOX_CUSTOMER = {
      object: "customer",
      id: "cus_000009273325",
      dateCreated: "2026-09-29",
      name: "Aluno Sem Documento B3",
      email: null,
      cpfCnpj: null,
      personType: null,
      externalReference: "probe-no-cpf",
      deleted: false,
      country: "Brasil",
    };

    it("creates a customer on the root account", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { ...SANDBOX_CUSTOMER, cpfCnpj: "41763193640" }),
      );

      const customer = await AsaasClient.root().createCustomer({
        name: "Aluno Teste",
        cpfCnpj: "41763193640",
        externalReference: "user-1",
        notificationDisabled: true,
      });

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/v3/customers`);
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({
        name: "Aluno Teste",
        cpfCnpj: "41763193640",
        externalReference: "user-1",
        notificationDisabled: true,
      });
      expect(customer.id).toBe("cus_000009273325");
      expect(customer.cpfCnpj).toBe("41763193640");
    });

    it("normalises a customer that came back without a document", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, SANDBOX_CUSTOMER));
      const customer = await AsaasClient.root().createCustomer({
        name: "Aluno Teste",
        cpfCnpj: "41763193640",
      });
      expect(customer.cpfCnpj).toBeNull();
    });

    it("refuses a creation response with no id", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { object: "customer" }));
      await expect(
        AsaasClient.root().createCustomer({ name: "X", cpfCnpj: "1" }),
      ).rejects.toMatchObject({ statusCode: 502 });
    });

    it("finds a customer by our own user id", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { totalCount: 1, data: [SANDBOX_CUSTOMER] }),
      );

      const found =
        await AsaasClient.root().findCustomerByExternalReference("probe-no-cpf");

      expect(fetchMock.mock.calls[0]![0]).toBe(
        `${BASE_URL}/v3/customers?externalReference=probe-no-cpf`,
      );
      expect(found?.id).toBe("cus_000009273325");
    });

    it("returns undefined when no customer carries that reference", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { totalCount: 0, data: [] }));
      expect(
        await AsaasClient.root().findCustomerByExternalReference("user-404"),
      ).toBeUndefined();
    });

    it("escapes the reference into the query string", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { data: [] }));
      await AsaasClient.root().findCustomerByExternalReference("a b&c");
      expect(fetchMock.mock.calls[0]![0]).toBe(
        `${BASE_URL}/v3/customers?externalReference=a+b%26c`,
      );
    });
  });

  describe("charges", () => {
    // The sandbox's own answers on 2026-09-29, kept verbatim.
    const SANDBOX_PAYMENT = {
      object: "payment",
      id: "pay_flhul7uhgq4drw4d",
      status: "PENDING",
      value: 150.0,
      netValue: 149.01,
      billingType: "PIX",
      dueDate: "2026-10-02",
      deleted: false,
    };

    const SANDBOX_QR = {
      success: true,
      encodedImage: "iVBORw0KGgoAAAANSUhEUgAAAcIAAAHCAQ",
      payload:
        "00020101021226820014br.gov.bcb.pix2560pix-h.asaas.com/qr/cobv/f7e89c58-7383-459e-bef7-00451747eee25204000053039865802BR5921EFA FIREFLY LABS LTDA6009Sao Paulo6108013119146207050***63048B0A",
      expirationDate: "2027-10-02 23:59:59",
      description: "probe b3",
    };

    it("creates a charge carrying the whole split to the academy wallet", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, SANDBOX_PAYMENT));

      const payment = await AsaasClient.root().createPayment({
        customer: "cus_1",
        billingType: "PIX",
        value: 150,
        dueDate: "2026-10-02",
        split: [{ walletId: "wal_1", percentualValue: 100 }],
      });

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/v3/payments`);
      expect(JSON.parse(init.body as string).split).toEqual([
        { walletId: "wal_1", percentualValue: 100 },
      ]);
      expect(payment.id).toBe("pay_flhul7uhgq4drw4d");
      expect(payment.netValue).toBe(149.01);
    });

    it("refuses a charge response with no id", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { object: "payment" }));
      await expect(
        AsaasClient.root().createPayment({
          customer: "c",
          billingType: "PIX",
          value: 1,
          dueDate: "2026-10-02",
        }),
      ).rejects.toMatchObject({ statusCode: 502 });
    });

    it("reads the QR code of a charge", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, SANDBOX_QR));

      const qr = await AsaasClient.root().getPixQrCode("pay_1");

      expect(fetchMock.mock.calls[0]![0]).toBe(
        `${BASE_URL}/v3/payments/pay_1/pixQrCode`,
      );
      expect(qr.payload).toContain("br.gov.bcb.pix");
      expect(qr.expirationDate).toBe("2027-10-02 23:59:59");
    });

    it("refuses a QR response missing the payload", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { success: true }));
      await expect(
        AsaasClient.root().getPixQrCode("pay_1"),
      ).rejects.toMatchObject({ statusCode: 502 });
    });

    // Blocker 4: the charge lives on the root account, so the QR fails until
    // *that* account has a Pix key — and Asaas provisions it asynchronously, so
    // a freshly created account fails for its first minutes. The sentence below
    // is the only thing that explains the failure, so it must not be flattened
    // into a generic 502.
    it("passes the missing-Pix-key rejection through verbatim", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(400, {
          errors: [
            {
              code: "invalid_action",
              description:
                "Você não possui uma chave Pix cadastrada para recebimentos.",
            },
          ],
        }),
      );

      await expect(
        AsaasClient.root().getPixQrCode("pay_1"),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Você não possui uma chave Pix cadastrada para recebimentos.",
        details: { code: "invalid_action" },
      });
    });

    it("reads a charge back, deleted flag included", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { ...SANDBOX_PAYMENT, deleted: true }),
      );

      const found = await AsaasClient.root().findPayment("pay_1");

      expect(fetchMock.mock.calls[0]![0]).toBe(`${BASE_URL}/v3/payments/pay_1`);
      expect(found?.deleted).toBe(true);
    });

    it("answers undefined for a charge Asaas no longer has", async () => {
      fetchMock.mockResolvedValue(jsonResponse(404, { errors: [] }));
      expect(await AsaasClient.root().findPayment("pay_gone")).toBeUndefined();
    });

    it("deletes a charge", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { deleted: true, id: "pay_1" }),
      );

      await AsaasClient.root().deletePayment("pay_1");

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/v3/payments/pay_1`);
      expect(init.method).toBe("DELETE");
    });

    // A charge that is already gone is the outcome the caller wanted.
    it("treats deleting a charge that no longer exists as done", async () => {
      fetchMock.mockResolvedValue(jsonResponse(404, { errors: [] }));
      await expect(
        AsaasClient.root().deletePayment("pay_gone"),
      ).resolves.toBeUndefined();
    });

    it("still raises anything other than a 404 on delete", async () => {
      fetchMock.mockResolvedValue(jsonResponse(500, {}));
      await expect(
        AsaasClient.root().deletePayment("pay_1"),
      ).rejects.toMatchObject({ statusCode: 502 });
    });
  });
  describe("checkouts", () => {
    // The sandbox's own answer on 2026-09-29, kept verbatim. Note `split`
    // singular coming back where the request sent `splits`, and the value
    // under `percentageValue` rather than the payments spelling.
    const SANDBOX_CHECKOUT = {
      id: "28934c1d-2ded-4ee0-a7bb-8f305b28681a",
      link: "https://sandbox.asaas.com/checkoutSession/show/28934c1d-2ded-4ee0-a7bb-8f305b28681a",
      status: "ACTIVE",
      minutesToExpire: 120,
      externalReference: "B5PROBE-sub-2026-09-01",
      billingTypes: ["CREDIT_CARD"],
      chargeTypes: ["DETACHED"],
      callback: {
        cancelUrl: "https://example.test/v1/payments/checkout-result?status=cancel",
        successUrl: "https://example.test/v1/payments/checkout-result?status=success",
        expiredUrl: "https://example.test/v1/payments/checkout-result?status=expired",
      },
      items: [
        {
          name: "Plano Mensal — 2026-09",
          description: null,
          externalReference: null,
          quantity: 1,
          value: 150.0,
        },
      ],
      subscription: null,
      installment: null,
      split: [
        {
          walletId: "742f6df1-c4ee-4645-87a6-523b50345be5",
          fixedValue: null,
          percentageValue: 100.0,
          totalFixedValue: null,
        },
      ],
      customer: null,
      customerData: null,
    };

    const input = {
      billingTypes: ["CREDIT_CARD"] as const,
      chargeTypes: ["DETACHED"] as const,
      minutesToExpire: 60,
      items: [{ name: "Plano Mensal — 2026-09", quantity: 1, value: 150 }],
      callback: {
        successUrl: "https://example.test/v1/payments/checkout-result?status=success",
        cancelUrl: "https://example.test/v1/payments/checkout-result?status=cancel",
      },
    };

    it("creates a checkout carrying the whole split to the academy wallet", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, SANDBOX_CHECKOUT));

      const checkout = await AsaasClient.root().createCheckout({
        ...input,
        billingTypes: ["CREDIT_CARD"],
        chargeTypes: ["DETACHED"],
        splits: [{ walletId: "wal_1", percentageValue: 100 }],
      });

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/v3/checkouts`);
      expect(init.method).toBe("POST");
      expect(checkout.id).toBe("28934c1d-2ded-4ee0-a7bb-8f305b28681a");
      expect(checkout.link).toBe(SANDBOX_CHECKOUT.link);
    });

    // The one difference from `/v3/payments` that a copy-paste would miss:
    // `percentualValue` is rejected outright here, so the request has to carry
    // `percentageValue` and nothing may quietly translate between them.
    it("sends the split under the spelling the checkout endpoint requires", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, SANDBOX_CHECKOUT));

      await AsaasClient.root().createCheckout({
        ...input,
        billingTypes: ["CREDIT_CARD"],
        chargeTypes: ["DETACHED"],
        splits: [{ walletId: "wal_1", percentageValue: 100 }],
      });

      const body = JSON.parse(
        (fetchMock.mock.calls[0]![1] as RequestInit).body as string,
      ) as Record<string, unknown>;
      expect(body.splits).toEqual([
        { walletId: "wal_1", percentageValue: 100 },
      ]);
      expect(body).not.toHaveProperty("split");
    });

    // Asaas answers 400 with the missing field named, and that sentence is
    // what has to reach the student's screen.
    it("passes an Asaas rejection through verbatim", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(400, {
          errors: [
            {
              code: "invalid_object",
              description: "O campo callback deve ser informado.",
            },
          ],
        }),
      );

      await expect(
        AsaasClient.root().createCheckout({
          ...input,
          billingTypes: ["CREDIT_CARD"],
          chargeTypes: ["DETACHED"],
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "O campo callback deve ser informado.",
      });
    });

    it("refuses a checkout response with no link", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: "chk_1" }));
      await expect(
        AsaasClient.root().createCheckout({
          ...input,
          billingTypes: ["CREDIT_CARD"],
          chargeTypes: ["DETACHED"],
        }),
      ).rejects.toMatchObject({ statusCode: 502 });
    });

    it("cancels a checkout", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { ...SANDBOX_CHECKOUT, status: "CANCELED" }),
      );

      await AsaasClient.root().cancelCheckout("chk_1");

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/v3/checkouts/chk_1/cancel`);
      expect(init.method).toBe("POST");
    });

    // Unlike DELETE /v3/payments, Asaas is not idempotent here: a second
    // cancel, or one on a session already paid or expired, answers this exact
    // 400. All of them mean the session is no longer payable, which is what
    // the caller asked for.
    it("treats a checkout that is no longer active as already cancelled", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(400, {
          errors: [
            {
              code: "invalid_action",
              description: "O Checkout não está ativo para ser cancelado.",
            },
          ],
        }),
      );

      await expect(
        AsaasClient.root().cancelCheckout("chk_done"),
      ).resolves.toBeUndefined();
    });

    it("treats cancelling a checkout that never existed as done", async () => {
      fetchMock.mockResolvedValue(jsonResponse(404, { errors: [] }));
      await expect(
        AsaasClient.root().cancelCheckout("chk_gone"),
      ).resolves.toBeUndefined();
    });

    // A 400 that is *not* invalid_action is the student's data being refused,
    // and swallowing it would report a cancellation that never happened.
    it("still raises a rejection that is not an inactive checkout", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(400, {
          errors: [{ code: "invalid_object", description: "Algo errado" }],
        }),
      );
      await expect(
        AsaasClient.root().cancelCheckout("chk_1"),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("still raises anything other than a 404 on cancel", async () => {
      fetchMock.mockResolvedValue(jsonResponse(500, {}));
      await expect(
        AsaasClient.root().cancelCheckout("chk_1"),
      ).rejects.toMatchObject({ statusCode: 502 });
    });
  });
});
