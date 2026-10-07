import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../lib/http-error.js";
import {
  CHECKOUT,
  currentReferenceMonth,
  setupAsaasCharges as setup,
} from "../../testing/asaas-charge-harness.js";
import { makeAcademy } from "../../testing/factories/index.js";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import {
  InMemoryStudentSubscriptionRepository,
  InMemorySubscriptionPlanRepository,
} from "../subscription/subscription.repository.in-memory.js";
import { InMemoryPaymentRepository } from "./payment.repository.in-memory.js";
import { PaymentService } from "./payment.service.js";

const PUBLIC_URL = "https://tatame.test/v1";

describe("PaymentService.createCheckout", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    ctx = await setup();
  });

  it("sends the whole split to the academy wallet", async () => {
    await ctx.service.createCheckout(ctx.studentId, ctx.academyId, PUBLIC_URL);

    expect(ctx.client.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        billingTypes: ["CREDIT_CARD"],
        chargeTypes: ["DETACHED"],
        splits: [{ walletId: "wal_academy", percentageValue: 100 }],
        externalReference: ctx.subscriptionId,
      }),
    );
  });

  // `POST /v3/checkouts` rejects `percentualValue` outright — the spelling the
  // Pix charge next door is required to use. A copy-paste between the two is
  // the mistake this guards, and it fails at Asaas, not at compile time.
  it("never sends the payments spelling of the split percentage", async () => {
    await ctx.service.createCheckout(ctx.studentId, ctx.academyId, PUBLIC_URL);

    const [sent] = ctx.client.createCheckout.mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(sent.split).toBeUndefined();
    expect(sent.splits).toEqual([
      { walletId: "wal_academy", percentageValue: 100 },
    ]);
    expect(JSON.stringify(sent)).not.toContain("percentualValue");
  });

  it("keeps the contract mobile already speaks", async () => {
    const result = await ctx.service.createCheckout(
      ctx.studentId,
      ctx.academyId,
      PUBLIC_URL,
    );

    expect(result).toEqual({ checkoutUrl: CHECKOUT.link });
  });

  it("charges the plan price for the current month", async () => {
    await ctx.service.createCheckout(ctx.studentId, ctx.academyId, PUBLIC_URL);

    const [sent] = ctx.client.createCheckout.mock.calls[0] as [
      { items: { name: string; quantity: number; value: number }[] },
    ];
    expect(sent.items).toEqual([
      {
        name: `${ctx.plan.name} — ${currentReferenceMonth().slice(0, 7)}`,
        quantity: 1,
        value: 150,
      },
    ]);
  });

  it("sends Asaas all three places to return the student to", async () => {
    await ctx.service.createCheckout(ctx.studentId, ctx.academyId, PUBLIC_URL);

    const [sent] = ctx.client.createCheckout.mock.calls[0] as [
      { callback: Record<string, string> },
    ];
    expect(sent.callback).toEqual({
      successUrl: `${PUBLIC_URL}/payments/checkout-result?status=success`,
      cancelUrl: `${PUBLIC_URL}/payments/checkout-result?status=cancel`,
      expiredUrl: `${PUBLIC_URL}/payments/checkout-result?status=expired`,
    });
  });

  it("does not double the slash when the public url carries one", async () => {
    await ctx.service.createCheckout(
      ctx.studentId,
      ctx.academyId,
      `${PUBLIC_URL}/`,
    );

    const [sent] = ctx.client.createCheckout.mock.calls[0] as [
      { callback: Record<string, string> },
    ];
    expect(sent.callback.successUrl).toBe(
      `${PUBLIC_URL}/payments/checkout-result?status=success`,
    );
  });

  // The webhook arrives carrying a payment whose `checkoutSession` is this id
  // and nothing else we can trust. Without the row, the money has no
  // subscription and no month to be recorded against.
  it("records what the webhook will need, keyed by the checkout session", async () => {
    await ctx.service.createCheckout(ctx.studentId, ctx.academyId, PUBLIC_URL);

    expect(await ctx.payRepo.findPendingAsaasByPaymentId(CHECKOUT.id)).toEqual({
      asaasPaymentId: CHECKOUT.id,
      kind: "checkout",
      subscriptionId: ctx.subscriptionId,
      userId: ctx.studentId,
      academyId: ctx.academyId,
      referenceMonth: currentReferenceMonth(),
      amountCents: 15000,
    });
  });

  // Asaas demands a full address on any customer bound to a checkout, and the
  // platform holds none (D7). The student identifies themselves on the Asaas
  // page instead, so the card rail must never ask for a document.
  it("never touches the student's Asaas customer", async () => {
    await ctx.service.createCheckout(ctx.studentId, ctx.academyId, PUBLIC_URL);

    expect(ctx.client.createCustomer).not.toHaveBeenCalled();
    expect(ctx.client.findCustomerByExternalReference).not.toHaveBeenCalled();
    const [sent] = ctx.client.createCheckout.mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(sent.customer).toBeUndefined();
    expect(sent.customerData).toBeUndefined();
  });

  // Same window as the Pix rail, except what is left behind is a payable link
  // rather than a QR.
  it("cancels the checkout it just opened when the pending row cannot be written", async () => {
    vi.spyOn(ctx.payRepo, "createPendingAsaas").mockRejectedValue(
      new Error("connection terminated unexpectedly"),
    );

    await expect(
      ctx.service.createCheckout(ctx.studentId, ctx.academyId, PUBLIC_URL),
    ).rejects.toThrow("connection terminated unexpectedly");

    expect(ctx.client.cancelCheckout).toHaveBeenCalledWith(CHECKOUT.id);
  });

  it("cancels the loser's checkout and 409s when another request won the month", async () => {
    await ctx.payRepo.createPendingAsaas({
      asaasPaymentId: "pay_winner",
      kind: "payment",
      subscriptionId: ctx.subscriptionId,
      userId: ctx.studentId,
      academyId: ctx.academyId,
      referenceMonth: currentReferenceMonth(),
      amountCents: 15000,
    });
    vi.spyOn(
      ctx.payRepo,
      "findPendingAsaasBySubscriptionMonth",
    ).mockResolvedValue(undefined);

    await expect(
      ctx.service.createCheckout(ctx.studentId, ctx.academyId, PUBLIC_URL),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(ctx.client.cancelCheckout).toHaveBeenCalledWith(CHECKOUT.id);
    expect(
      await ctx.payRepo.findPendingAsaasByPaymentId("pay_winner"),
    ).toMatchObject({ asaasPaymentId: "pay_winner" });
  });

  it("refuses an academy that cannot receive yet", async () => {
    const pending = await setup({ accountStatus: "pending" });

    await expect(
      pending.service.createCheckout(
        pending.studentId,
        pending.academyId,
        PUBLIC_URL,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { code: "PAYOUT_ACCOUNT_REQUIRED" },
    });
    expect(pending.client.createCheckout).not.toHaveBeenCalled();
  });

  it("refuses an academy with no payout account at all", async () => {
    const none = await setup({ accountStatus: "none" });

    await expect(
      none.service.createCheckout(none.studentId, none.academyId, PUBLIC_URL),
    ).rejects.toMatchObject({ details: { code: "PAYOUT_ACCOUNT_REQUIRED" } });
    expect(none.client.createCheckout).not.toHaveBeenCalled();
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
      ctx.service.createCheckout(ctx.studentId, ctx.academyId, PUBLIC_URL),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(ctx.client.createCheckout).not.toHaveBeenCalled();
  });

  it("404s a student with no active subscription here", async () => {
    await expect(
      ctx.service.createCheckout(randomUUID(), ctx.academyId, PUBLIC_URL),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(ctx.client.createCheckout).not.toHaveBeenCalled();
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
      unwired.createCheckout(randomUUID(), academy.id, PUBLIC_URL),
    ).rejects.toMatchObject({ statusCode: 503 });
  });

  // A checkout that failed to be created must leave nothing claiming the month,
  // or the retry finds a row pointing at a session Asaas never opened.
  it("records nothing when Asaas refuses the checkout", async () => {
    const refused = await setup({
      asaas: {
        createCheckout: vi
          .fn()
          .mockRejectedValue(new HttpError(400, "O Asaas recusou os dados")),
      },
    });

    await expect(
      refused.service.createCheckout(
        refused.studentId,
        refused.academyId,
        PUBLIC_URL,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(
      await refused.payRepo.findPendingAsaasBySubscriptionMonth(
        refused.subscriptionId,
        currentReferenceMonth(),
      ),
    ).toBeUndefined();
  });
});

/**
 * The two rails meeting on one month. A student can open a Pix QR and then
 * decide to pay by card, or the reverse; whichever they abandon has to stop
 * being payable, or the month is payable twice.
 */
describe("a month that already has a charge open on the other rail", () => {
  it("cancels an open Pix charge before opening a checkout", async () => {
    const ctx = await setup();
    await ctx.payRepo.createPendingAsaas({
      asaasPaymentId: "pay_open",
      kind: "payment",
      subscriptionId: ctx.subscriptionId,
      userId: ctx.studentId,
      academyId: ctx.academyId,
      referenceMonth: currentReferenceMonth(),
      amountCents: 15000,
    });

    await ctx.service.createCheckout(ctx.studentId, ctx.academyId, PUBLIC_URL);

    expect(ctx.client.deletePayment).toHaveBeenCalledWith("pay_open");
    expect(ctx.client.cancelCheckout).not.toHaveBeenCalled();
    expect(
      await ctx.payRepo.findPendingAsaasByPaymentId("pay_open"),
    ).toBeUndefined();
  });

  // Tapping "pagar com cartão" twice must not leave the first link payable.
  it("cancels the previous checkout before opening another", async () => {
    const ctx = await setup();
    await ctx.payRepo.createPendingAsaas({
      asaasPaymentId: "chk_old",
      kind: "checkout",
      subscriptionId: ctx.subscriptionId,
      userId: ctx.studentId,
      academyId: ctx.academyId,
      referenceMonth: currentReferenceMonth(),
      amountCents: 15000,
    });

    await ctx.service.createCheckout(ctx.studentId, ctx.academyId, PUBLIC_URL);

    expect(ctx.client.cancelCheckout).toHaveBeenCalledWith("chk_old");
    expect(ctx.client.deletePayment).not.toHaveBeenCalled();
    expect(
      await ctx.payRepo.findPendingAsaasByPaymentId("chk_old"),
    ).toBeUndefined();
    expect(
      await ctx.payRepo.findPendingAsaasByPaymentId(CHECKOUT.id),
    ).toBeDefined();
  });

  // A checkout link cannot be handed back the way a Pix QR can, so the Pix
  // path cancels it rather than reusing it.
  it("cancels an open checkout before opening a Pix charge", async () => {
    const ctx = await setup();
    await ctx.payRepo.createPendingAsaas({
      asaasPaymentId: "chk_old",
      kind: "checkout",
      subscriptionId: ctx.subscriptionId,
      userId: ctx.studentId,
      academyId: ctx.academyId,
      referenceMonth: currentReferenceMonth(),
      amountCents: 15000,
    });

    const view = await ctx.service.createPixCharge(
      ctx.studentId,
      ctx.academyId,
      { cpfCnpj: "41763193640" },
    );

    expect(ctx.client.cancelCheckout).toHaveBeenCalledWith("chk_old");
    // and it must not have been mistaken for a charge along the way
    expect(ctx.client.findPayment).not.toHaveBeenCalled();
    expect(ctx.client.deletePayment).not.toHaveBeenCalled();
    expect(view.paymentId).toBe("pay_new");
  });

  // The whole reason `kind` exists. `DELETE /v3/payments/{id}` answers 404 for
  // a checkout id and the wrapper reads 404 as success, so a manual settlement
  // that guessed would report success and leave the link payable — exactly the
  // hole D5 exists to close, re-opened on the card rail.
  it("cancels the checkout, not a payment, when a month is settled by hand", async () => {
    const ctx = await setup();
    const referenceMonth = currentReferenceMonth();
    await ctx.payRepo.createPendingAsaas({
      asaasPaymentId: "chk_open",
      kind: "checkout",
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

    expect(ctx.client.cancelCheckout).toHaveBeenCalledWith("chk_open");
    expect(ctx.client.deletePayment).not.toHaveBeenCalled();
    expect(
      await ctx.payRepo.findPendingAsaasByPaymentId("chk_open"),
    ).toBeUndefined();
  });

  // Same rule as the Pix half of D5: recording the payment while leaving a
  // payable link open is the failure, so the confirmation must not happen.
  it("records nothing when the checkout could not be cancelled", async () => {
    const ctx = await setup({
      asaas: {
        cancelCheckout: vi
          .fn()
          .mockRejectedValue(new HttpError(502, "Asaas está indisponível")),
      },
    });
    const referenceMonth = currentReferenceMonth();
    await ctx.payRepo.createPendingAsaas({
      asaasPaymentId: "chk_open",
      kind: "checkout",
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

    expect(await ctx.payRepo.findByAcademy(ctx.academyId, {})).toHaveLength(0);
  });
});
