import type { ConfirmManualPaymentBody } from "@tatame/validators";
import type Stripe from "stripe";
import { HttpError } from "../../lib/http-error.js";
import { emitEvent } from "../../telemetry/events.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { IManagerSubscriptionRepository } from "../manager-subscription/manager-subscription.repository.js";
import type { NotificationDispatcher } from "../notification/notification-dispatcher.js";
import type { IPayoutAccountRepository } from "../payout-account/payout-account.repository.js";
import type { IStudentSubscriptionRepository } from "../subscription/subscription.repository.js";
import type { AsaasCustomerService } from "./asaas-customer.service.js";
import type { AsaasRootClientFactory } from "./asaas-customer.service.js";
import type {
  IPaymentRepository,
  PaymentRow,
  PaymentWithUser,
} from "./payment.repository.js";

/** What the student sends when asking for a Pix charge. */
export interface CreatePixChargeInput {
  subscriptionId?: string;
  /**
   * Required only the first time a student pays: Asaas refuses to charge a
   * customer with no document, and the platform stores none (D7).
   */
  cpfCnpj?: string;
}

export interface PixChargeView {
  paymentId: string;
  encodedImage: string;
  payload: string;
  expirationDate: string | null;
  amountCents: number;
  referenceMonth: string;
}

/** Everything the Asaas charge path needs, absent when Asaas is not wired. */
interface AsaasDeps {
  asaas: AsaasRootClientFactory;
  customers: AsaasCustomerService;
  payoutAccountRepo: IPayoutAccountRepository;
}

export class PaymentService {
  constructor(
    private readonly paymentRepo: IPaymentRepository,
    private readonly studentSubRepo: IStudentSubscriptionRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly dispatcher?: NotificationDispatcher,
    private readonly managerSubRepo?: IManagerSubscriptionRepository,
    private readonly payoutAccountRepo?: IPayoutAccountRepository,
    private readonly asaas?: AsaasRootClientFactory,
    private readonly customers?: AsaasCustomerService,
  ) {}

  /**
   * Unlike `dispatcher`, a missing Asaas dependency is not allowed to degrade
   * quietly — the alternative to a split charge is a charge that pays the
   * platform instead of the academy.
   */
  private requireAsaas(): AsaasDeps {
    if (!this.asaas || !this.customers || !this.payoutAccountRepo) {
      throw new HttpError(503, "Asaas is not configured");
    }
    return {
      asaas: this.asaas,
      customers: this.customers,
      payoutAccountRepo: this.payoutAccountRepo,
    };
  }

  async confirmManual(
    managerUserId: string,
    academyId: string,
    body: ConfirmManualPaymentBody,
  ): Promise<PaymentRow> {
    await this.assertManagerOwnsAcademy(managerUserId, academyId);

    const sub = await this.studentSubRepo.findByIdWithPlan(body.subscriptionId);
    if (!sub) {
      throw new HttpError(404, "Subscription not found");
    }
    if (sub.plan.academyId !== academyId) {
      throw new HttpError(404, "Subscription not found");
    }

    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) {
      throw new HttpError(400, "Invalid paidAt");
    }

    // D5, and it has to happen *before* the payment row exists. Asaas leaves a
    // hand-settled charge payable — `receiveInCash` only cancels the split, so
    // the money would land in the subaccount with no row to match it — and a
    // deleted charge still serves a valid-looking QR, so a lingering pending
    // row would hand the student a dead code next month. Cancelling first means
    // an Asaas outage costs the manager a retry rather than opening exactly the
    // double-payment hole this exists to close.
    await this.cancelOpenAsaasCharge(sub.subscription.id, body.referenceMonth);

    const result = await this.paymentRepo.create({
      subscriptionId: sub.subscription.id,
      userId: sub.subscription.userId,
      academyId,
      amountCents: body.amountCents,
      method: "manual",
      confirmedBy: managerUserId,
      stripePaymentId: null,
      referenceMonth: body.referenceMonth,
      notes: body.notes ?? null,
      paidAt,
    });

    if (this.dispatcher) {
      // Notify student
      void this.dispatcher.notifyUsers(
        "payment_confirmed",
        [result.userId],
        [sub.plan.name],
        { academyId },
      );
    }

    return result;
  }

  /**
   * Removes the Asaas charge for a month being settled by hand, and the pending
   * row with it. The two deletions are one unit: a pending row whose charge is
   * gone is what makes `createPixCharge` hand out a QR for a cancelled charge.
   *
   * A no-op when Asaas is not wired, or when the month has no open charge —
   * which is every manual payment for an academy that never used Asaas.
   */
  private async cancelOpenAsaasCharge(
    subscriptionId: string,
    referenceMonth: string,
  ): Promise<void> {
    if (!this.asaas) return;

    const open = await this.paymentRepo.findPendingAsaasBySubscriptionMonth(
      subscriptionId,
      referenceMonth,
    );
    if (!open) return;

    await this.asaas.root().deletePayment(open.asaasPaymentId);
    await this.paymentRepo.deletePendingAsaas(open.asaasPaymentId);
  }

  /**
   * The QR code, with the one failure that must not be flattened.
   *
   * The charge lives on the **root** account, so this fails until that account
   * has a Pix key — and Asaas provisions it asynchronously, so a freshly
   * created one fails for its first minutes. `AsaasClient` already passes the
   * 400 through verbatim; all this adds is the signal, because an `HttpError`
   * short-circuits the error handler before anything else reports it. No
   * academy needs a key of its own: the charge is the root account's and the
   * split moves the money internally.
   */
  private async fetchPixQrCode(
    asaas: AsaasRootClientFactory,
    asaasPaymentId: string,
    academyId: string,
  ) {
    try {
      return await asaas.root().getPixQrCode(asaasPaymentId);
    } catch (error) {
      emitEvent("payment.charge_failed", {
        academyId,
        extra: {
          stage: "pix_qr_code",
          asaasPaymentId,
          code:
            error instanceof HttpError
              ? (error.details?.code ?? null)
              : null,
          message: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  /**
   * A Pix charge on Asaas, split whole into the academy's wallet.
   *
   * The charge is created on the platform's root account and
   * `percentualValue: 100` moves the net value to the academy — Asaas splits
   * over `netValue`, so the academy receives the charge minus the Asaas fee and
   * the platform nets exactly zero (D1/D3).
   */
  async createPixCharge(
    studentUserId: string,
    academyId: string,
    input: CreatePixChargeInput = {},
  ): Promise<PixChargeView> {
    const { asaas, customers, payoutAccountRepo } = this.requireAsaas();

    if (this.managerSubRepo) {
      const managerSub = await this.managerSubRepo.findByAcademyId(academyId);
      if (managerSub?.plan === "free") {
        throw new HttpError(
          403,
          "Pagamentos automáticos não estão disponíveis para o plano atual",
          { code: "PLAN_LIMIT_PAYMENTS" },
        );
      }
    }

    const subs = await this.studentSubRepo.listWithPlanByUserAndAcademy(
      studentUserId,
      academyId,
    );
    const active = input.subscriptionId
      ? subs.find(
          (s) =>
            s.subscription.id === input.subscriptionId &&
            s.subscription.status === "active",
        )
      : subs.find((s) => s.subscription.status === "active");

    if (!active) {
      throw new HttpError(404, "No active subscription found");
    }

    const { subscription, plan } = active;

    const today = new Date().toISOString().slice(0, 10);
    const referenceMonth = today.slice(0, 7) + "-01";

    const alreadyPaid =
      await this.paymentRepo.existsForSubscriptionReferenceMonth(
        subscription.id,
        referenceMonth,
      );
    if (alreadyPaid) {
      throw new HttpError(409, "Payment already exists for this period");
    }

    // One lookup serves two purposes: it is the gate, and it is where the
    // wallet the split is addressed to comes from. Not flag-gated the way
    // `SubscriptionService` gates enrolment — without a wallet there is nothing
    // to split into, and a charge with no split pays the platform instead of
    // the academy (D4).
    const account = await payoutAccountRepo.findByAcademyId(academyId);
    if (!account || account.status !== "approved") {
      throw new HttpError(
        403,
        "A academia ainda não pode receber pagamentos automáticos",
        { code: "PAYOUT_ACCOUNT_REQUIRED" },
      );
    }

    const open = await this.paymentRepo.findPendingAsaasBySubscriptionMonth(
      subscription.id,
      referenceMonth,
    );
    if (open) {
      // Asaas serves a QR for a deleted charge just as happily as for a live
      // one, so the charge has to be read back. A row left behind by a charge
      // cancelled elsewhere repairs itself here instead of becoming a dead QR.
      const live = await asaas.root().findPayment(open.asaasPaymentId);
      if (live && !live.deleted) {
        const reused = await this.fetchPixQrCode(
          asaas,
          open.asaasPaymentId,
          academyId,
        );
        return {
          paymentId: open.asaasPaymentId,
          encodedImage: reused.encodedImage,
          payload: reused.payload,
          expirationDate: reused.expirationDate,
          amountCents: open.amountCents,
          referenceMonth,
        };
      }
      await this.paymentRepo.deletePendingAsaas(open.asaasPaymentId);
    }

    const customerId = await customers.ensureCustomer(studentUserId, {
      cpfCnpj: input.cpfCnpj,
    });

    let charge;
    try {
      charge = await asaas.root().createPayment({
        customer: customerId,
        billingType: "PIX",
        value: Number((plan.priceCents / 100).toFixed(2)),
        dueDate: today,
        description: `${plan.name} — ${referenceMonth.slice(0, 7)}`,
        externalReference: subscription.id,
        split: [{ walletId: account.walletId, percentualValue: 100 }],
      });
    } catch (error) {
      emitEvent("payment.charge_failed", {
        userId: studentUserId,
        academyId,
        subscriptionId: subscription.id,
        extra: {
          stage: "create_payment",
          code:
            error instanceof HttpError
              ? (error.details?.code ?? null)
              : null,
          message: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }

    // Persisted before the QR is fetched, on purpose. The QR is the call that
    // fails while the root account's Pix key is still being provisioned, and a
    // charge with no pending row behind it is one a retry cannot find — it
    // would open a second charge for the same month. This way the retry reuses
    // the charge that already exists.
    await this.paymentRepo.createPendingAsaas({
      asaasPaymentId: charge.id,
      subscriptionId: subscription.id,
      userId: studentUserId,
      academyId,
      referenceMonth,
      amountCents: plan.priceCents,
    });

    const qr = await this.fetchPixQrCode(asaas, charge.id, academyId);

    return {
      paymentId: charge.id,
      encodedImage: qr.encodedImage,
      payload: qr.payload,
      expirationDate: qr.expirationDate,
      amountCents: plan.priceCents,
      referenceMonth,
    };
  }

  async listForManager(
    managerUserId: string,
    academyId: string,
    opts: { subscriptionId?: string; limit?: number },
  ): Promise<PaymentWithUser[]> {
    await this.assertManagerOwnsAcademy(managerUserId, academyId);
    return this.paymentRepo.findByAcademyWithUser(academyId, {
      subscriptionId: opts.subscriptionId,
      limit: opts.limit,
    });
  }

  async listForStudent(
    studentUserId: string,
    academyId: string,
  ): Promise<PaymentRow[]> {
    return this.paymentRepo.findByAcademy(academyId, { userId: studentUserId });
  }

  async listForDependent(dependentId: string): Promise<PaymentRow[]> {
    return this.paymentRepo.findByDependentId(dependentId);
  }

  async createCheckoutSession(
    studentUserId: string,
    academyId: string,
    studentEmail: string,
    stripe: Stripe,
    apiPublicUrl: string,
    opts?: { subscriptionId?: string },
  ): Promise<{ checkoutUrl: string }> {
    // Plan limit enforcement — free plan cannot use auto payment
    if (this.managerSubRepo) {
      const managerSub = await this.managerSubRepo.findByAcademyId(academyId);
      if (managerSub?.plan === "free") {
        throw new HttpError(403, "Pagamentos automáticos não estão disponíveis para o plano atual", {
          code: "PLAN_LIMIT_PAYMENTS",
        });
      }
    }

    const subs = await this.studentSubRepo.listWithPlanByUserAndAcademy(
      studentUserId,
      academyId,
    );
    const active = opts?.subscriptionId
      ? subs.find(
          (s) =>
            s.subscription.id === opts.subscriptionId &&
            s.subscription.status === "active",
        )
      : subs.find((s) => s.subscription.status === "active");

    if (!active) {
      throw new HttpError(404, "No active subscription found");
    }

    const { subscription, plan } = active;

    const today = new Date().toISOString().slice(0, 10);
    const referenceMonth = today.slice(0, 7) + "-01";

    const alreadyPaid = await this.paymentRepo.existsForSubscriptionReferenceMonth(
      subscription.id,
      referenceMonth,
    );
    if (alreadyPaid) {
      throw new HttpError(409, "Payment already exists for this period");
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: studentEmail,
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: plan.priceCents,
            product_data: { name: `${plan.name} — ${referenceMonth.slice(0, 7)}` },
          },
          quantity: 1,
        },
      ],
      metadata: {
        subscriptionId: subscription.id,
        userId: studentUserId,
        academyId,
        referenceMonth,
        ...(subscription.dependentId ? { dependentId: subscription.dependentId } : {}),
      },
      success_url: `${apiPublicUrl}/payments/checkout-result?status=success`,
      cancel_url: `${apiPublicUrl}/payments/checkout-result?status=cancel`,
    });

    if (!session.url) {
      throw new HttpError(500, "Failed to create checkout session");
    }

    return { checkoutUrl: session.url };
  }

  async createPixQrCode(
    studentUserId: string,
    academyId: string,
    abacatePayApiKey: string,
    opts?: { subscriptionId?: string },
  ): Promise<{
    pixQrCodeId: string;
    brCode: string;
    brCodeBase64: string;
    amount: number;
    expiresAt: string;
    metadata: { subscriptionId: string; userId: string; academyId: string; referenceMonth: string };
  }> {
    // Plan limit enforcement — free plan cannot use auto payment
    if (this.managerSubRepo) {
      const managerSub = await this.managerSubRepo.findByAcademyId(academyId);
      if (managerSub?.plan === "free") {
        throw new HttpError(403, "Pagamentos automáticos não estão disponíveis para o plano atual", {
          code: "PLAN_LIMIT_PAYMENTS",
        });
      }
    }

    const subs = await this.studentSubRepo.listWithPlanByUserAndAcademy(
      studentUserId,
      academyId,
    );
    const active = opts?.subscriptionId
      ? subs.find(
          (s) =>
            s.subscription.id === opts.subscriptionId &&
            s.subscription.status === "active",
        )
      : subs.find((s) => s.subscription.status === "active");

    if (!active) {
      throw new HttpError(404, "No active subscription found");
    }

    const { subscription, plan } = active;

    const today = new Date().toISOString().slice(0, 10);
    const referenceMonth = today.slice(0, 7) + "-01";

    const alreadyPaid = await this.paymentRepo.existsForSubscriptionReferenceMonth(
      subscription.id,
      referenceMonth,
    );
    if (alreadyPaid) {
      throw new HttpError(409, "Payment already exists for this period");
    }

    const description = `${plan.name} — ${referenceMonth.slice(0, 7)}`;

    const abacateRes = await fetch("https://api.abacatepay.com/v1/pixQrCode/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${abacatePayApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: plan.priceCents,
        expiresIn: 1800, // 30 minutes
        description,
      }),
    });

    const rawText = await abacateRes.text();
    let result: { error?: string; data?: { id: string; brCode: string; brCodeBase64: string; amount: number; expiresAt: string } };
    try {
      result = JSON.parse(rawText) as typeof result;
    } catch {
      throw new HttpError(502, `AbacatePay returned invalid response: ${rawText.slice(0, 200)}`);
    }

    if (!abacateRes.ok || result.error) {
      throw new HttpError(502, result.error ?? "AbacatePay request failed");
    }

    const data = result.data;
    if (!data?.brCode) {
      throw new HttpError(500, "Failed to create Pix QR code");
    }

    const metadata = {
      subscriptionId: subscription.id,
      userId: studentUserId,
      academyId,
      referenceMonth,
    };

    // Store metadata locally so the webhook can look it up by pixQrCodeId
    await this.paymentRepo.createPendingPix({
      pixQrCodeId: data.id,
      subscriptionId: subscription.id,
      userId: studentUserId,
      academyId,
      referenceMonth,
      amountCents: plan.priceCents,
    });

    return {
      pixQrCodeId: data.id,
      brCode: data.brCode,
      brCodeBase64: data.brCodeBase64,
      amount: data.amount,
      expiresAt: data.expiresAt,
      metadata,
    };
  }

  private async assertManagerOwnsAcademy(userId: string, academyId: string) {
    const academy = await this.academyRepo.findById(academyId);
    if (!academy) {
      throw new HttpError(404, "Academy not found");
    }
    if (academy.ownerId !== userId) {
      throw new HttpError(403, "You do not manage this academy");
    }
  }
}
