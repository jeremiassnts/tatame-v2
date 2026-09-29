import type { ConfirmManualPaymentBody } from "@tatame/validators";
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
  PendingAsaasPayment,
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

/** What the student sends when asking for a card checkout. */
export interface CreateCheckoutInput {
  subscriptionId?: string;
}

/**
 * How long an Asaas checkout stays payable. Expiry is what stops an abandoned
 * link from being paid weeks later against a month settled some other way, so
 * it is deliberately short rather than generous.
 */
const CHECKOUT_EXPIRY_MINUTES = 60;

export interface PixChargeView {
  paymentId: string;
  encodedImage: string;
  payload: string;
  expirationDate: string | null;
  amountCents: number;
  referenceMonth: string;
}

type SubscriptionWithPlan = Awaited<
  ReturnType<IStudentSubscriptionRepository["listWithPlanByUserAndAcademy"]>
>[number];

/** What both Asaas charge paths establish before they may spend a call. */
interface ChargeContext {
  active: SubscriptionWithPlan;
  account: NonNullable<
    Awaited<ReturnType<IPayoutAccountRepository["findByAcademyId"]>>
  >;
  /** `YYYY-MM-DD`, today. */
  today: string;
  /** `YYYY-MM-01`, the billing period today falls in. */
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

    // Before D5's cancellation, not after: a month that is already paid is a
    // request to reject, and rejecting it must not first cancel the student's
    // open charge as a side effect. `createPixCharge` and `createCheckout` ask
    // the same question through `openChargeContext`; this path is the one a
    // human drives, and it was the only one that could bill a month twice.
    //
    // There is no unique constraint behind this — deliberately. `payment.reversed`
    // writes nothing, so a refunded month keeps its row, and a constraint would
    // stop the student from ever paying that month again.
    const alreadyPaid =
      await this.paymentRepo.existsForSubscriptionReferenceMonth(
        sub.subscription.id,
        body.referenceMonth,
      );
    if (alreadyPaid) {
      throw new HttpError(409, "Payment already exists for this period");
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

    await this.cancelAsaasHandle(open);
    await this.paymentRepo.deletePendingAsaas(open.asaasPaymentId);
  }

  /**
   * Closes whichever kind of Asaas charge a pending row is holding.
   *
   * Reading `kind` rather than guessing is load-bearing. Both endpoints answer
   * 404 for the other kind's id, and both wrappers treat a 404 as success — so
   * cancelling a checkout with `deletePayment` would report success while
   * leaving a link the student can still pay. That is exactly the
   * double-payment hole D5 exists to close, re-opened on the card rail.
   */
  private async cancelAsaasHandle(open: PendingAsaasPayment): Promise<void> {
    const client = this.asaas!.root();
    if (open.kind === "checkout") {
      await client.cancelCheckout(open.asaasPaymentId);
      return;
    }
    await client.deletePayment(open.asaasPaymentId);
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
  /**
   * Everything both charge paths must establish before spending an Asaas call:
   * the plan allows automatic payment, the student has an active subscription,
   * the month is not already paid, and the academy can receive.
   *
   * Shared on purpose. The payout-account lookup is both the gate and the
   * source of the wallet the split is addressed to, so a path that forgot it
   * would not fail — it would open a charge that pays the platform instead of
   * the academy (D4). One copy is one thing to get right.
   */
  private async openChargeContext(
    studentUserId: string,
    academyId: string,
    payoutAccountRepo: IPayoutAccountRepository,
    subscriptionId?: string,
  ): Promise<ChargeContext> {
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
    const active = subscriptionId
      ? subs.find(
          (s) =>
            s.subscription.id === subscriptionId &&
            s.subscription.status === "active",
        )
      : subs.find((s) => s.subscription.status === "active");

    if (!active) {
      throw new HttpError(404, "No active subscription found");
    }

    const today = new Date().toISOString().slice(0, 10);
    const referenceMonth = today.slice(0, 7) + "-01";

    const alreadyPaid =
      await this.paymentRepo.existsForSubscriptionReferenceMonth(
        active.subscription.id,
        referenceMonth,
      );
    if (alreadyPaid) {
      throw new HttpError(409, "Payment already exists for this period");
    }

    // Not flag-gated the way `SubscriptionService` gates enrolment: without a
    // wallet there is nothing to split into at all.
    const account = await payoutAccountRepo.findByAcademyId(academyId);
    if (!account || account.status !== "approved") {
      throw new HttpError(
        403,
        "A academia ainda não pode receber pagamentos automáticos",
        { code: "PAYOUT_ACCOUNT_REQUIRED" },
      );
    }

    return { active, account, today, referenceMonth };
  }

  async createPixCharge(
    studentUserId: string,
    academyId: string,
    input: CreatePixChargeInput = {},
  ): Promise<PixChargeView> {
    const { asaas, customers, payoutAccountRepo } = this.requireAsaas();

    const { active, account, today, referenceMonth } =
      await this.openChargeContext(
        studentUserId,
        academyId,
        payoutAccountRepo,
        input.subscriptionId,
      );
    const { subscription, plan } = active;

    const open = await this.paymentRepo.findPendingAsaasBySubscriptionMonth(
      subscription.id,
      referenceMonth,
    );
    if (open) {
      if (open.kind === "payment") {
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
      } else {
        // A card checkout the student opened and then changed their mind
        // about. It cannot be handed back here — it is a link, not a QR — and
        // leaving it alive next to a fresh Pix charge makes the month payable
        // twice.
        await asaas.root().cancelCheckout(open.asaasPaymentId);
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
      kind: "payment",
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

  /**
   * A hosted card checkout on Asaas, split whole into the academy's wallet,
   * behind the same gate as the Pix charge.
   *
   * Three things differ from `createPixCharge`, all forced by the API:
   *
   * 1. The split field is `percentageValue`. `POST /v3/checkouts` rejects the
   *    `percentualValue` that `POST /v3/payments` requires.
   * 2. There is no payment id yet. Asaas answers a checkout session id, and
   *    the payment it eventually creates points back with `checkoutSession` —
   *    the checkout's own `externalReference` is *not* copied onto it. So the
   *    pending row is keyed by the session id and marked `kind: "checkout"`.
   * 3. The student's Asaas customer is not attached. Asaas demands a full
   *    address on any customer bound here, and the platform holds none (D7),
   *    so the student identifies themselves on the Asaas page instead.
   *
   * An open charge for the month is cancelled rather than reused, whichever
   * kind it is: a checkout link cannot be handed back the way a QR can, and
   * two live charges make the month payable twice.
   */
  async createCheckout(
    studentUserId: string,
    academyId: string,
    apiPublicUrl: string,
    input: CreateCheckoutInput = {},
  ): Promise<{ checkoutUrl: string }> {
    const { asaas, payoutAccountRepo } = this.requireAsaas();

    const { active, account, referenceMonth } = await this.openChargeContext(
      studentUserId,
      academyId,
      payoutAccountRepo,
      input.subscriptionId,
    );
    const { subscription, plan } = active;

    await this.cancelOpenAsaasCharge(subscription.id, referenceMonth);

    const resultUrl = (status: string) =>
      `${apiPublicUrl.replace(/\/$/, "")}/payments/checkout-result?status=${status}`;

    let checkout;
    try {
      checkout = await asaas.root().createCheckout({
        billingTypes: ["CREDIT_CARD"],
        chargeTypes: ["DETACHED"],
        minutesToExpire: CHECKOUT_EXPIRY_MINUTES,
        items: [
          {
            name: `${plan.name} — ${referenceMonth.slice(0, 7)}`,
            quantity: 1,
            value: Number((plan.priceCents / 100).toFixed(2)),
          },
        ],
        callback: {
          successUrl: resultUrl("success"),
          cancelUrl: resultUrl("cancel"),
          expiredUrl: resultUrl("expired"),
        },
        splits: [{ walletId: account.walletId, percentageValue: 100 }],
        externalReference: subscription.id,
      });
    } catch (error) {
      emitEvent("payment.charge_failed", {
        userId: studentUserId,
        academyId,
        subscriptionId: subscription.id,
        extra: {
          stage: "create_checkout",
          code:
            error instanceof HttpError ? (error.details?.code ?? null) : null,
          message: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }

    // The link is live from here on, so the row that makes it reconcilable has
    // to exist even if the student never comes back. Without it the webhook
    // arrives with a payment whose `checkoutSession` matches nothing, and the
    // money has no subscription or month to be recorded against.
    await this.paymentRepo.createPendingAsaas({
      asaasPaymentId: checkout.id,
      kind: "checkout",
      subscriptionId: subscription.id,
      userId: studentUserId,
      academyId,
      referenceMonth,
      amountCents: plan.priceCents,
    });

    return { checkoutUrl: checkout.link };
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
