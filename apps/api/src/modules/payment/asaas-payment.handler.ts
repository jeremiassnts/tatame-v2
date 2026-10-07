import { emitEvent } from "../../telemetry/events.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { EmailService } from "../email/email.service.js";
import type { NotificationDispatcher } from "../notification/notification-dispatcher.js";
import type { IStudentSubscriptionRepository } from "../subscription/subscription.repository.js";
import type { IUserRepository } from "../user/user.repository.js";
import type { IPaymentRepository } from "./payment.repository.js";

/**
 * The `PAYMENT_*` deliveries from Asaas — the only thing that records a student
 * payment. No client is trusted to say money arrived.
 *
 * The charge lives on the platform's **root** account, so these events come
 * from the root webhook, not from the academy's subaccount: a subaccount that
 * is merely the recipient of a split is not notified. Verified against the
 * sandbox on 2026-09-29 — a card payment split 100% into an academy's wallet
 * delivered nothing until a webhook existed on the root account, and arrived
 * within a second once it did.
 */

export interface AsaasPaymentEvent {
  id?: string;
  event?: string;
  dateCreated?: string;
  account?: { id?: string; ownerId?: string | null };
  payment?: {
    id?: string;
    status?: string;
    value?: number;
    netValue?: number | null;
    billingType?: string;
    /**
     * Present on a payment that came from a checkout, and the only way back to
     * the pending row: the checkout's `externalReference` is **not** copied
     * onto the payment it produces.
     */
    checkoutSession?: string | null;
    externalReference?: string | null;
    confirmedDate?: string | null;
    paymentDate?: string | null;
    clientPaymentDate?: string | null;
    deleted?: boolean;
    /**
     * The academy's side of the charge, and the only place it is reported: the
     * `GET /v3/payments/{id}/splits` collection answers 404. A reversal arrives
     * with the split already `CANCELLED` and `cancellationReason` naming the
     * cause — `PAYMENT_REFUNDED` on a refund, `PAYMENT_RECEIVED_IN_CASH` on a
     * manual settlement (D5).
     */
    split?: Array<{
      status?: string | null;
      cancellationReason?: string | null;
    }> | null;
    /**
     * Present on the `PAYMENT_CHARGEBACK_*` deliveries. Shaped after the Asaas
     * documentation rather than a capture: the sandbox has no way to provoke a
     * chargeback — `GET /v3/chargebacks` exists and is empty, and every
     * `simulateChargeback` spelling answers 404 — so the first real one will be
     * in production. Both fields are read defensively for that reason.
     */
    chargeback?: { status?: string | null; reason?: string | null } | null;
  };
}

export const PAYMENT_EVENT_PREFIX = "PAYMENT_";

/**
 * The two that mean the money is ours to record. Asaas sends `CONFIRMED` when
 * the payment is approved and `RECEIVED` when it settles — two events for one
 * payment, which is why idempotency is a unique constraint and not a flag.
 */
const SETTLED_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);

/**
 * Deliveries we cause ourselves and must not alert on. Every manual settlement
 * deletes the month's open charge (D5), and so does either charge path finding
 * a stale one — reporting those as unhandled would make a false drop alert the
 * normal outcome of a manager taking cash at the counter.
 */
const SELF_INFLICTED_EVENTS = new Set(["PAYMENT_DELETED"]);

/**
 * Money going back out. Reported, never acted on — see `payment.reversed` in
 * the telemetry catalog.
 *
 * The first four are what the root webhook is registered for. The last two are
 * not registered and so never arrive today; they are here because the whole
 * point of a broad signal is that the next reversal Asaas invents lands in it
 * instead of in `UNKNOWN_EVENT_TYPE`. Registering them is a production webhook
 * change, not a code one.
 *
 * `PAYMENT_REFUND_DENIED` is deliberately absent: it exists only for bank
 * slips, which this platform does not issue.
 */
const REVERSAL_EVENTS = new Set([
  "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
  "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
  "PAYMENT_PARTIALLY_REFUNDED",
  "PAYMENT_REFUND_IN_PROGRESS",
]);

/**
 * Our own root account id at Asaas, or `null` when it could not be determined.
 * Resolved once and cached; it never changes for a given key.
 */
export type RootAccountIdResolver = () => Promise<string | null>;

export class AsaasPaymentWebhookHandler {
  constructor(
    private readonly paymentRepo: IPaymentRepository,
    private readonly userRepo: IUserRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly emailService: EmailService | null,
    private readonly dispatcher?: NotificationDispatcher,
    private readonly studentSubRepo?: IStudentSubscriptionRepository,
    private readonly rootAccountId?: RootAccountIdResolver,
  ) {}

  async handleEvent(event: AsaasPaymentEvent): Promise<void> {
    const type = event.event ?? "";

    if (await this.isForeign(event)) {
      emitEvent("payment.webhook_unhandled", {
        reason: "FOREIGN_ACCOUNT",
        extra: {
          provider: "asaas",
          type: type || "(missing)",
          sender: event.account?.id ?? null,
        },
      });
      return;
    }

    if (SELF_INFLICTED_EVENTS.has(type)) return;

    if (REVERSAL_EVENTS.has(type)) {
      await this.reportReversal(event, type);
      return;
    }

    if (!SETTLED_EVENTS.has(type)) {
      // Everything the root webhook is registered for is handled above, so
      // reaching here means a registration nobody wrote code for. Reported
      // rather than dropped, because this endpoint is the only place that can
      // say which Asaas events actually arrive.
      emitEvent("payment.webhook_unhandled", {
        reason: "UNKNOWN_EVENT_TYPE",
        extra: { provider: "asaas", type: type || "(missing)" },
      });
      return;
    }

    const asaasPaymentId = event.payment?.id;
    if (!asaasPaymentId) {
      emitEvent("payment.webhook_unhandled", {
        reason: "MISSING_REFERENCE",
        extra: { provider: "asaas", cause: `no payment.id on ${type}` },
      });
      return;
    }

    // The pre-check. It is not what makes this idempotent — the unique
    // constraint on `payments.asaas_payment_id` is, and it is what survives
    // `PAYMENT_CONFIRMED` and `PAYMENT_RECEIVED` arriving at once. This only
    // saves the work. A provider redelivering is the system working, not a
    // drop, so nothing is reported.
    if (await this.paymentRepo.findByAsaasPaymentId(asaasPaymentId)) return;

    const pending = await this.findPending(event, asaasPaymentId);
    if (!pending) {
      // The expensive one. Money arrived and there is no row saying which
      // student or which month it belongs to, so no payment is recorded and
      // the student stays overdue. Nothing downstream notices: the route still
      // answers 200 and Asaas considers the delivery done.
      emitEvent("payment.webhook_unhandled", {
        reason: "NO_PENDING_CHARGE",
        extra: {
          provider: "asaas",
          type,
          asaasPaymentId,
          checkoutSession: event.payment?.checkoutSession ?? null,
        },
      });
      return;
    }

    // `findByAsaasPaymentId` above makes a redelivery a no-op, but it cannot
    // see a payment recorded through another rail. The manual one is the case
    // that happens: a manager confirms the month by hand while a card checkout
    // is open, and `cancelCheckout` has to swallow Asaas's 400 because it is
    // the same 400 an expired session gives. So the student's card payment
    // lands here against a month that is already closed.
    if (
      await this.paymentRepo.existsForSubscriptionReferenceMonth(
        pending.subscriptionId,
        pending.referenceMonth,
      )
    ) {
      emitEvent("payment.webhook_unhandled", {
        reason: "DUPLICATE_MONTH",
        userId: pending.userId,
        academyId: pending.academyId,
        subscriptionId: pending.subscriptionId,
        extra: {
          provider: "asaas",
          type,
          asaasPaymentId,
          referenceMonth: pending.referenceMonth,
        },
      });
      // The pending row is left alone on purpose. Deleting it would make an
      // Asaas redelivery report NO_PENDING_CHARGE — "money in, nothing
      // recorded" — which is the wrong story and the louder alert. Nothing
      // else trips over it: every caller of `cancelOpenAsaasCharge` is keyed
      // to this same subscription and month, and all three are now behind the
      // already-paid guard.
      return;
    }

    let dependentId: string | null = null;
    if (this.studentSubRepo) {
      const sub = await this.studentSubRepo.findByIdWithPlan(
        pending.subscriptionId,
      );
      dependentId = sub?.subscription.dependentId ?? null;
    }

    let payment;
    try {
      payment = await this.paymentRepo.create({
        subscriptionId: pending.subscriptionId,
        userId: pending.userId,
        academyId: pending.academyId,
        // The plan price the charge was opened for, not the value Asaas
        // reports. They are the same today, and if they ever diverge the row
        // has to say what the student owed for the month.
        amountCents: pending.amountCents,
        method: methodFor(event.payment?.billingType),
        confirmedBy: null,
        stripePaymentId: null,
        asaasPaymentId,
        referenceMonth: pending.referenceMonth,
        notes: null,
        paidAt: paidAtFrom(event),
        dependentId,
      });
    } catch (error) {
      // `PAYMENT_CONFIRMED` and `PAYMENT_RECEIVED` can be in flight together,
      // and then both pass the pre-check above before either writes. The
      // unique constraint is what settles it, and losing that race means the
      // payment is recorded — by the other delivery. Letting it surface would
      // answer 500 to a webhook that succeeded, and Asaas would retry for days
      // against a payment already on the books.
      if (!isDuplicateAsaasPayment(error)) throw error;
      await this.paymentRepo.deletePendingAsaas(pending.asaasPaymentId);
      return;
    }

    emitEvent("payment.confirmed", {
      userId: payment.userId,
      academyId: payment.academyId,
      paymentId: payment.id,
      subscriptionId: payment.subscriptionId,
      extra: {
        provider: "asaas",
        method: payment.method,
        amountCents: payment.amountCents,
      },
    });

    // Only now: while this row exists, both charge paths believe the month has
    // a charge open and will try to cancel it.
    await this.paymentRepo.deletePendingAsaas(pending.asaasPaymentId);

    await this.announce(pending, payment.id, payment.amountCents, payment.referenceMonth);
  }

  /**
   * A refund or a chargeback. Emits and stops.
   *
   * It looks the payment up first so the signal can name the academy whose
   * wallet the money comes out of — without that it is a payment id and a date,
   * and answering "which academy do we owe an explanation to?" means a query
   * against the database by hand. `recorded: false` is itself worth seeing: a
   * reversal of a charge we never recorded means the settlement was dropped too,
   * and the `NO_PENDING_CHARGE` that should have fired is somewhere further
   * back in the log.
   *
   * Nothing is written. A redelivery therefore emits twice, which is correct —
   * the record is a log line describing a delivery, not a row describing money.
   */
  private async reportReversal(
    event: AsaasPaymentEvent,
    type: string,
  ): Promise<void> {
    const asaasPaymentId = event.payment?.id;
    const recorded = asaasPaymentId
      ? await this.paymentRepo.findByAsaasPaymentId(asaasPaymentId)
      : undefined;
    // Asaas sends one split per recipient and these charges have exactly one:
    // the academy's wallet, at 100%.
    const split = event.payment?.split?.[0];

    emitEvent("payment.reversed", {
      userId: recorded?.userId,
      academyId: recorded?.academyId,
      subscriptionId: recorded?.subscriptionId,
      paymentId: recorded?.id,
      extra: {
        provider: "asaas",
        type,
        status: event.payment?.status ?? null,
        asaasPaymentId: asaasPaymentId ?? null,
        recorded: !!recorded,
        splitStatus: split?.status ?? null,
        splitCancellationReason: split?.cancellationReason ?? null,
        chargebackStatus: event.payment?.chargeback?.status ?? null,
        chargebackReason: event.payment?.chargeback?.reason ?? null,
      },
    });
  }

  /**
   * Whether this delivery came from an Asaas account that is not ours.
   *
   * Every charge lives on the platform's root account, so a `PAYMENT_*` event
   * carries that account's id — and a sandbox key and a production key are
   * different accounts. This is what keeps one environment's events from being
   * processed by another when the same webhook url or token ends up in both.
   * Without it a production delivery reaching a development API raises
   * `NO_PENDING_CHARGE`, the loudest signal in this file, for an event that was
   * never ours to record.
   *
   * Deliberately **fails open**. If our own id cannot be determined — Asaas
   * unreachable, key not configured — every event is accepted, because
   * refusing the money stream on a lookup failure loses real payments to save
   * a misconfiguration that may not exist.
   *
   * `ACCOUNT_STATUS_*` needs nothing equivalent: its `account.id` is the
   * *subaccount's*, and its handler already refuses an account with no row
   * here.
   */
  private async isForeign(event: AsaasPaymentEvent): Promise<boolean> {
    const sender = event.account?.id;
    if (!sender || !this.rootAccountId) return false;
    const ours = await this.rootAccountId();
    return ours !== null && sender !== ours;
  }

  /**
   * A Pix charge is keyed by its own payment id. A card payment has no id until
   * it exists, so its row was keyed by the checkout session that produced it.
   */
  private async findPending(event: AsaasPaymentEvent, asaasPaymentId: string) {
    const direct =
      await this.paymentRepo.findPendingAsaasByPaymentId(asaasPaymentId);
    if (direct) return direct;

    const session = event.payment?.checkoutSession;
    if (!session) return undefined;
    return this.paymentRepo.findPendingAsaasByPaymentId(session);
  }

  /** Push and e-mail. Never allowed to undo a payment that is already recorded. */
  private async announce(
    pending: { userId: string; academyId: string },
    paymentId: string,
    amountCents: number,
    referenceMonth: string,
  ): Promise<void> {
    const student = await this.userRepo.findById(pending.userId);

    if (this.dispatcher) {
      void this.dispatcher.notifyUsers(
        "payment_confirmed",
        [pending.userId],
        ["assinatura"],
        { academyId: pending.academyId },
      );
      void this.dispatcher.notifyAcademyManagers(
        "student_payment_received",
        pending.academyId,
        [student?.name ?? "Aluno", "assinatura"],
      );
    }

    if (!this.emailService) return;

    const academy = await this.academyRepo.findById(pending.academyId);
    if (!student || !academy) {
      // Softer than the drops above: the payment is recorded, only its e-mails
      // are skipped. Still a referential hole worth knowing about.
      emitEvent("payment.webhook_unhandled", {
        reason: "USER_OR_ACADEMY_NOT_FOUND",
        userId: pending.userId,
        academyId: pending.academyId,
        paymentId,
        extra: { provider: "asaas", cause: "confirmation email skipped" },
      });
      return;
    }

    await this.emailService.sendPaymentConfirmed(
      {
        email: student.email,
        studentName: student.name,
        academyName: academy.name,
        amountCents,
        referenceMonth,
      },
      paymentId,
    );

    const owner = await this.userRepo.findById(academy.ownerId);
    if (!owner) {
      emitEvent("payment.webhook_unhandled", {
        reason: "OWNER_NOT_FOUND",
        academyId: pending.academyId,
        paymentId,
        extra: { provider: "asaas", cause: "manager email skipped" },
      });
      return;
    }

    await this.emailService.sendStudentPaymentReceived(
      {
        email: owner.email,
        managerName: owner.name,
        academyName: academy.name,
        studentName: student.name,
        amountCents,
        referenceMonth,
        hasPixKey: !!academy.pixKey,
      },
      paymentId,
    );
  }
}

/**
 * The unique constraint on `payments.asaas_payment_id` firing — the only thing
 * that keeps two simultaneous deliveries of one payment to a single row. Matched
 * on the message because that is all the driver gives us, and narrowed to the
 * column so a unique violation somewhere else still surfaces.
 */
function isDuplicateAsaasPayment(error: unknown): boolean {
  return (
    error instanceof Error &&
    /duplicate key|unique constraint/i.test(error.message) &&
    /asaas_payment_id/i.test(error.message)
  );
}

/**
 * `payments.method` answers "how did the student pay?", never "through which
 * provider" — that is what `asaas_payment_id` and `stripe_payment_id` are for.
 * So a card payment is `stripe` here, which is the value that has always meant
 * "card, in the app" and already renders as "Cartão" everywhere. The name is
 * stale rather than wrong; renaming it belongs with B9, when Stripe actually
 * leaves and the 255 existing rows can be migrated in one coherent change.
 */
function methodFor(billingType: string | undefined): "pix" | "stripe" {
  return billingType === "PIX" ? "pix" : "stripe";
}

/**
 * When the student actually paid, as Asaas reports it. `PAYMENT_CONFIRMED`
 * carries `confirmedDate` and a null `paymentDate`; `PAYMENT_RECEIVED` carries
 * both. Falling back to now keeps a payment with an unparseable date recorded
 * rather than rejected — a wrong-by-hours `paidAt` is worth far less than the
 * row itself.
 */
function paidAtFrom(event: AsaasPaymentEvent): Date {
  const raw =
    event.payment?.paymentDate ??
    event.payment?.clientPaymentDate ??
    event.payment?.confirmedDate;
  if (!raw) return new Date();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
