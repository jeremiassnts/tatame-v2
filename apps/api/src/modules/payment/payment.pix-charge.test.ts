import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../lib/http-error.js";
import {
  makeAcademy,
  makeStudentSubscription,
  makeSubscriptionPlan,
} from "../../testing/factories/index.js";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import { InMemoryPayoutAccountRepository } from "../payout-account/payout-account.repository.in-memory.js";
import type { PayoutAccountRow } from "../payout-account/payout-account.repository.js";
import {
  InMemoryStudentSubscriptionRepository,
  InMemorySubscriptionPlanRepository,
} from "../subscription/subscription.repository.in-memory.js";
import { InMemoryUserRepository } from "../user/user.repository.in-memory.js";
import { AsaasCustomerService } from "./asaas-customer.service.js";
import { InMemoryPaymentRepository } from "./payment.repository.in-memory.js";
import type { PaymentRow } from "./payment.repository.js";
import { PaymentService } from "./payment.service.js";

const QR = {
  encodedImage: "iVBORw0KGgo",
  payload: "00020101021226820014br.gov.bcb.pix",
  expirationDate: "2027-10-02 23:59:59",
};

function payoutAccount(
  academyId: string,
  status: PayoutAccountRow["status"] = "approved",
): PayoutAccountRow {
  const t = new Date();
  return {
    id: randomUUID(),
    academyId,
    provider: "asaas",
    externalAccountId: "acc_1",
    walletId: "wal_academy",
    apiKeyEncrypted: "sealed",
    status,
    generalStatus: status === "approved" ? "APPROVED" : "PENDING",
    commercialInfoStatus: null,
    documentStatus: null,
    bankAccountInfoStatus: null,
    onboardingUrl: null,
    rejectionReason: null,
    approvedAt: status === "approved" ? t : null,
    createdAt: t,
    updatedAt: t,
  };
}

function currentReferenceMonth(): string {
  return new Date().toISOString().slice(0, 7) + "-01";
}

async function setup(
  opts: {
    accountStatus?: PayoutAccountRow["status"] | "none";
    asaas?: Partial<{
      createPayment: ReturnType<typeof vi.fn>;
      getPixQrCode: ReturnType<typeof vi.fn>;
      findPayment: ReturnType<typeof vi.fn>;
      deletePayment: ReturnType<typeof vi.fn>;
      createCustomer: ReturnType<typeof vi.fn>;
      findCustomerByExternalReference: ReturnType<typeof vi.fn>;
    }>;
  } = {},
) {
  const managerId = randomUUID();
  const academy = makeAcademy({ ownerId: managerId });
  const plan = makeSubscriptionPlan({ academyId: academy.id, priceCents: 15000 });
  const planRepo = new InMemorySubscriptionPlanRepository([plan]);

  const userRepo = new InMemoryUserRepository();
  await userRepo.upsert({
    clerkUserId: "user_student",
    email: "aluno@example.com",
    name: "Aluno Teste",
    profileImageUrl: null,
  });
  const student = (await userRepo.findByClerkId("user_student"))!;

  const subscription = makeStudentSubscription({
    userId: student.id,
    planId: plan.id,
    status: "active",
  });
  const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, [
    subscription,
  ]);

  const payRows: PaymentRow[] = [];
  const payRepo = new InMemoryPaymentRepository(payRows);

  const accountStatus = opts.accountStatus ?? "approved";
  const payoutRepo = new InMemoryPayoutAccountRepository(
    accountStatus === "none" ? [] : [payoutAccount(academy.id, accountStatus)],
  );

  const client = {
    createPayment:
      opts.asaas?.createPayment ??
      vi.fn().mockResolvedValue({ id: "pay_new", status: "PENDING", value: 150 }),
    getPixQrCode: opts.asaas?.getPixQrCode ?? vi.fn().mockResolvedValue(QR),
    findPayment:
      opts.asaas?.findPayment ??
      vi.fn().mockResolvedValue({ id: "pay_open", status: "PENDING", value: 150, deleted: false }),
    deletePayment: opts.asaas?.deletePayment ?? vi.fn().mockResolvedValue(undefined),
    createCustomer:
      opts.asaas?.createCustomer ??
      vi.fn().mockResolvedValue({ id: "cus_1", name: "Aluno Teste", cpfCnpj: "41763193640" }),
    findCustomerByExternalReference:
      opts.asaas?.findCustomerByExternalReference ??
      vi.fn().mockResolvedValue(undefined),
  };
  const factory = { root: () => client as never };

  const service = new PaymentService(
    payRepo,
    subRepo,
    new InMemoryAcademyRepository([academy]),
    undefined,
    undefined,
    payoutRepo,
    factory,
    new AsaasCustomerService(userRepo, factory),
  );

  return {
    service,
    client,
    payRepo,
    userRepo,
    managerId,
    academyId: academy.id,
    studentId: student.id,
    subscriptionId: subscription.id,
    plan,
  };
}

describe("PaymentService.createPixCharge", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    ctx = await setup();
  });

  it("sends the whole split to the academy wallet", async () => {
    const view = await ctx.service.createPixCharge(ctx.studentId, ctx.academyId, {
      cpfCnpj: "41763193640",
    });

    expect(ctx.client.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_1",
        billingType: "PIX",
        value: 150,
        split: [{ walletId: "wal_academy", percentualValue: 100 }],
        externalReference: ctx.subscriptionId,
      }),
    );
    expect(view).toMatchObject({
      paymentId: "pay_new",
      encodedImage: QR.encodedImage,
      payload: QR.payload,
      amountCents: 15000,
      referenceMonth: currentReferenceMonth(),
    });
  });

  it("records what the webhook will need to reconcile the charge", async () => {
    await ctx.service.createPixCharge(ctx.studentId, ctx.academyId, {
      cpfCnpj: "41763193640",
    });

    expect(await ctx.payRepo.findPendingAsaasByPaymentId("pay_new")).toEqual({
      asaasPaymentId: "pay_new",
      subscriptionId: ctx.subscriptionId,
      userId: ctx.studentId,
      academyId: ctx.academyId,
      referenceMonth: currentReferenceMonth(),
      amountCents: 15000,
    });
  });

  it("refuses an academy that cannot receive yet", async () => {
    const pending = await setup({ accountStatus: "pending" });

    await expect(
      pending.service.createPixCharge(pending.studentId, pending.academyId, {
        cpfCnpj: "41763193640",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { code: "PAYOUT_ACCOUNT_REQUIRED" },
    });
    expect(pending.client.createPayment).not.toHaveBeenCalled();
  });

  it("refuses an academy with no payout account at all", async () => {
    const none = await setup({ accountStatus: "none" });

    await expect(
      none.service.createPixCharge(none.studentId, none.academyId, {
        cpfCnpj: "41763193640",
      }),
    ).rejects.toMatchObject({ details: { code: "PAYOUT_ACCOUNT_REQUIRED" } });
  });

  it("409s when the month is already paid", async () => {
    await ctx.payRepo.create({
      subscriptionId: ctx.subscriptionId,
      userId: ctx.studentId,
      academyId: ctx.academyId,
      amountCents: 15000,
      method: "manual",
      confirmedBy: null,
      stripePaymentId: null,
      referenceMonth: currentReferenceMonth(),
      notes: null,
      paidAt: new Date(),
    });

    await expect(
      ctx.service.createPixCharge(ctx.studentId, ctx.academyId, {
        cpfCnpj: "41763193640",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(ctx.client.createPayment).not.toHaveBeenCalled();
  });

  it("asks for the document before opening a charge, not after", async () => {
    await expect(
      ctx.service.createPixCharge(ctx.studentId, ctx.academyId, {}),
    ).rejects.toMatchObject({ details: { code: "CPF_REQUIRED" } });
    expect(ctx.client.createPayment).not.toHaveBeenCalled();
  });

  describe("reusing an open charge", () => {
    beforeEach(async () => {
      await ctx.payRepo.createPendingAsaas({
        asaasPaymentId: "pay_open",
        subscriptionId: ctx.subscriptionId,
        userId: ctx.studentId,
        academyId: ctx.academyId,
        referenceMonth: currentReferenceMonth(),
        amountCents: 15000,
      });
    });

    it("hands back the charge that already exists", async () => {
      const view = await ctx.service.createPixCharge(
        ctx.studentId,
        ctx.academyId,
        {},
      );

      expect(view.paymentId).toBe("pay_open");
      expect(ctx.client.createPayment).not.toHaveBeenCalled();
      expect(ctx.client.getPixQrCode).toHaveBeenCalledWith("pay_open");
    });

    // The reuse path never creates a customer, so it never needs the document.
    it("does not ask for the document again", async () => {
      await expect(
        ctx.service.createPixCharge(ctx.studentId, ctx.academyId, {}),
      ).resolves.toMatchObject({ paymentId: "pay_open" });
    });

    // Asaas serves a QR for a deleted charge exactly as it does for a live one,
    // so trusting the stored row would hand the student a dead code.
    it("opens a new charge when the stored one was cancelled at Asaas", async () => {
      ctx.client.findPayment.mockResolvedValue({
        id: "pay_open",
        status: "PENDING",
        value: 150,
        deleted: true,
      });

      const view = await ctx.service.createPixCharge(
        ctx.studentId,
        ctx.academyId,
        { cpfCnpj: "41763193640" },
      );

      expect(view.paymentId).toBe("pay_new");
      expect(ctx.client.createPayment).toHaveBeenCalledOnce();
      // and the stale row is gone, not left to be found again
      expect(
        await ctx.payRepo.findPendingAsaasByPaymentId("pay_open"),
      ).toBeUndefined();
    });

    it("opens a new charge when the stored one vanished from Asaas", async () => {
      ctx.client.findPayment.mockResolvedValue(undefined);

      const view = await ctx.service.createPixCharge(
        ctx.studentId,
        ctx.academyId,
        { cpfCnpj: "41763193640" },
      );

      expect(view.paymentId).toBe("pay_new");
    });
  });

  describe("when Asaas refuses", () => {
    // Blocker 4. The charge is the root account's, so the QR fails until that
    // account has a Pix key — provisioned asynchronously, so a fresh account
    // fails for its first minutes. The sentence is the only thing that explains
    // it, and it must reach the caller instead of becoming a generic 502.
    it("passes the missing-Pix-key message through", async () => {
      const broken = await setup({
        asaas: {
          getPixQrCode: vi
            .fn()
            .mockRejectedValue(
              new HttpError(
                400,
                "Você não possui uma chave Pix cadastrada para recebimentos.",
                { code: "invalid_action" },
              ),
            ),
        },
      });

      await expect(
        broken.service.createPixCharge(broken.studentId, broken.academyId, {
          cpfCnpj: "41763193640",
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Você não possui uma chave Pix cadastrada para recebimentos.",
        details: { code: "invalid_action" },
      });
    });

    // The charge exists at Asaas by then. Losing the pending row would make the
    // retry open a second charge for the same month.
    it("keeps the pending row when only the QR failed, so a retry reuses the charge", async () => {
      const broken = await setup({
        asaas: {
          getPixQrCode: vi
            .fn()
            .mockRejectedValueOnce(new HttpError(400, "sem chave pix"))
            .mockResolvedValue(QR),
        },
      });

      await expect(
        broken.service.createPixCharge(broken.studentId, broken.academyId, {
          cpfCnpj: "41763193640",
        }),
      ).rejects.toThrow();

      expect(
        await broken.payRepo.findPendingAsaasByPaymentId("pay_new"),
      ).toBeDefined();

      const retry = await broken.service.createPixCharge(
        broken.studentId,
        broken.academyId,
        {},
      );
      expect(retry.paymentId).toBe("pay_new");
      expect(broken.client.createPayment).toHaveBeenCalledOnce();
    });

    it("writes no pending row when the charge itself was refused", async () => {
      const broken = await setup({
        asaas: {
          createPayment: vi
            .fn()
            .mockRejectedValue(new HttpError(400, "Valor acima do limite")),
        },
      });

      await expect(
        broken.service.createPixCharge(broken.studentId, broken.academyId, {
          cpfCnpj: "41763193640",
        }),
      ).rejects.toMatchObject({ message: "Valor acima do limite" });
      expect(
        await broken.payRepo.findPendingAsaasByPaymentId("pay_new"),
      ).toBeUndefined();
    });
  });

  it("503s rather than charging without a split when Asaas is not wired", async () => {
    const academy = makeAcademy({});
    const planRepo = new InMemorySubscriptionPlanRepository([]);
    const unwired = new PaymentService(
      new InMemoryPaymentRepository([]),
      new InMemoryStudentSubscriptionRepository(planRepo, []),
      new InMemoryAcademyRepository([academy]),
    );

    await expect(
      unwired.createPixCharge(randomUUID(), academy.id, {}),
    ).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe("PaymentService.confirmManual cancelling the open charge (D5)", () => {
  it("cancels the Asaas charge and drops the pending row", async () => {
    const ctx = await setup();
    const referenceMonth = currentReferenceMonth();
    await ctx.payRepo.createPendingAsaas({
      asaasPaymentId: "pay_open",
      subscriptionId: ctx.subscriptionId,
      userId: ctx.studentId,
      academyId: ctx.academyId,
      referenceMonth,
      amountCents: 15000,
    });

    await ctx.service.confirmManual(ctx.managerId, ctx.academyId, {
      subscriptionId: ctx.subscriptionId,
      amountCents: 15000,
      referenceMonth,
      notes: null,
    });

    expect(ctx.client.deletePayment).toHaveBeenCalledWith("pay_open");
    expect(
      await ctx.payRepo.findPendingAsaasByPaymentId("pay_open"),
    ).toBeUndefined();
  });

  it("leaves other months alone", async () => {
    const ctx = await setup();
    await ctx.payRepo.createPendingAsaas({
      asaasPaymentId: "pay_other_month",
      subscriptionId: ctx.subscriptionId,
      userId: ctx.studentId,
      academyId: ctx.academyId,
      referenceMonth: "2026-01-01",
      amountCents: 15000,
    });

    await ctx.service.confirmManual(ctx.managerId, ctx.academyId, {
      subscriptionId: ctx.subscriptionId,
      amountCents: 15000,
      referenceMonth: "2026-02-01",
      notes: null,
    });

    expect(ctx.client.deletePayment).not.toHaveBeenCalled();
    expect(
      await ctx.payRepo.findPendingAsaasByPaymentId("pay_other_month"),
    ).toBeDefined();
  });

  it("does nothing special for a month with no open charge", async () => {
    const ctx = await setup();

    const row = await ctx.service.confirmManual(ctx.managerId, ctx.academyId, {
      subscriptionId: ctx.subscriptionId,
      amountCents: 15000,
      referenceMonth: currentReferenceMonth(),
      notes: null,
    });

    expect(row.method).toBe("manual");
    expect(ctx.client.deletePayment).not.toHaveBeenCalled();
  });

  // Recording the payment while leaving a payable charge open is precisely the
  // hole D5 exists to close, so the failure has to stop the confirmation.
  it("records nothing when the charge could not be cancelled", async () => {
    const ctx = await setup({
      asaas: {
        deletePayment: vi
          .fn()
          .mockRejectedValue(new HttpError(502, "Asaas está indisponível")),
      },
    });
    const referenceMonth = currentReferenceMonth();
    await ctx.payRepo.createPendingAsaas({
      asaasPaymentId: "pay_open",
      subscriptionId: ctx.subscriptionId,
      userId: ctx.studentId,
      academyId: ctx.academyId,
      referenceMonth,
      amountCents: 15000,
    });

    await expect(
      ctx.service.confirmManual(ctx.managerId, ctx.academyId, {
        subscriptionId: ctx.subscriptionId,
        amountCents: 15000,
        referenceMonth,
        notes: null,
      }),
    ).rejects.toMatchObject({ statusCode: 502 });

    expect(
      await ctx.payRepo.findByAcademy(ctx.academyId, {}),
    ).toHaveLength(0);
  });

  // An academy that never used Asaas must not be blocked by it.
  it("still confirms by hand when Asaas is not wired at all", async () => {
    const managerId = randomUUID();
    const academy = makeAcademy({ ownerId: managerId });
    const plan = makeSubscriptionPlan({ academyId: academy.id });
    const planRepo = new InMemorySubscriptionPlanRepository([plan]);
    const subscription = makeStudentSubscription({
      userId: randomUUID(),
      planId: plan.id,
      status: "active",
    });
    const unwired = new PaymentService(
      new InMemoryPaymentRepository([]),
      new InMemoryStudentSubscriptionRepository(planRepo, [subscription]),
      new InMemoryAcademyRepository([academy]),
    );

    const row = await unwired.confirmManual(managerId, academy.id, {
      subscriptionId: subscription.id,
      amountCents: 5000,
      referenceMonth: "2026-03-01",
      notes: null,
    });
    expect(row.amountCents).toBe(5000);
  });
});
