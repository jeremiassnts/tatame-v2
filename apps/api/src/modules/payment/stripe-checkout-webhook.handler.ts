import Stripe from "stripe";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { EmailService } from "../email/email.service.js";
import type { NotificationDispatcher } from "../notification/notification-dispatcher.js";
import type { IStudentSubscriptionRepository } from "../subscription/subscription.repository.js";
import type { IUserRepository } from "../user/user.repository.js";
import type { IPaymentRepository } from "./payment.repository.js";
import { emitEvent } from "../../telemetry/events.js";

export class StripeCheckoutWebhookHandler {
  constructor(
    private readonly paymentRepo: IPaymentRepository,
    private readonly userRepo: IUserRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly emailService: EmailService | null,
    private readonly dispatcher?: NotificationDispatcher,
    private readonly studentSubRepo?: IStudentSubscriptionRepository,
  ) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    // No `UNKNOWN_EVENT_TYPE` here, unlike the AbacatePay handler. The
    // `/webhooks/stripe` route calls this handler and then
    // `StripeSubscriptionWebhookHandler` on *the same event*, and that one
    // already emits `manager_subscription.webhook_unhandled` from its default
    // branch. Reporting here as well would double-count every Stripe event the
    // account sends, which is most of them.
    if (event.type !== "checkout.session.completed") return;
    await this.onCheckoutSessionCompleted(
      event.data.object,
    );
  }

  private async onCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const meta = session.metadata;
    if (
      !meta?.subscriptionId ||
      !meta.userId ||
      !meta.academyId ||
      !meta.referenceMonth
    ) {
      // The expensive one. The session completed — Stripe has the money — and
      // the metadata that says which subscription and which month it belongs to
      // is not there, so no payment row is written and the student stays
      // overdue. Nothing downstream notices: the route answers 200 and Stripe
      // considers the webhook delivered. `extra` names the missing keys rather
      // than dumping the metadata, which can hold anything.
      //
      // Joined here rather than passed as an array: `toAttributeValue` in
      // logger.ts turns anything that is not a scalar into JSON, and
      // `app.missing="academyId, referenceMonth"` reads better in a LogQL filter
      // than an escaped array does.
      emitEvent("payment.webhook_unhandled", {
        reason: "MISSING_REFERENCE",
        extra: {
          provider: "stripe",
          sessionId: session.id,
          missing: (
            ["subscriptionId", "userId", "academyId", "referenceMonth"] as const
          )
            .filter((key) => !meta?.[key])
            .join(", "),
        },
      });
      return;
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (paymentIntentId) {
      const existing = await this.paymentRepo.findByStripePaymentId(
        paymentIntentId,
      );
      // Deliberately not reported: Stripe retrying a webhook it already
      // delivered is the system working, not a drop.
      if (existing) return;
    }

    // Resolve dependentId from metadata or from the subscription
    let dependentId: string | null = meta.dependentId ?? null;
    if (!dependentId && this.studentSubRepo) {
      const subResult = await this.studentSubRepo.findByIdWithPlan(meta.subscriptionId);
      dependentId = subResult?.subscription.dependentId ?? null;
    }

    const payment = await this.paymentRepo.create({
      subscriptionId: meta.subscriptionId,
      userId: meta.userId,
      academyId: meta.academyId,
      amountCents: session.amount_total ?? 0,
      // The column says how the student paid, not who processed it. Stripe is
      // the provider; `stripe_payment_id` below is what records that.
      method: "card",
      confirmedBy: null,
      stripePaymentId: paymentIntentId ?? session.id,
      referenceMonth: meta.referenceMonth,
      notes: null,
      paidAt: new Date(),
      dependentId,
    });

    emitEvent("payment.confirmed", {
      userId: payment.userId,
      academyId: payment.academyId,
      paymentId: payment.id,
      subscriptionId: payment.subscriptionId,
      extra: { method: "card", amountCents: payment.amountCents },
    });

    // Push notifications
    if (this.dispatcher) {
      const student = await this.userRepo.findById(meta.userId);
      void this.dispatcher.notifyUsers(
        "payment_confirmed",
        [meta.userId],
        ["assinatura"],
        { academyId: meta.academyId },
      );
      void this.dispatcher.notifyAcademyManagers(
        "student_payment_received",
        meta.academyId,
        [student?.name ?? "Aluno", "assinatura"],
      );
    }

    if (!this.emailService) return;

    const student = await this.userRepo.findById(meta.userId);
    const academy = await this.academyRepo.findById(meta.academyId);
    if (!student || !academy) {
      // Softer than the drop above: the payment is recorded, only its emails are
      // skipped. Still a referential hole worth knowing about.
      emitEvent("payment.webhook_unhandled", {
        reason: "USER_OR_ACADEMY_NOT_FOUND",
        userId: meta.userId,
        academyId: meta.academyId,
        paymentId: payment.id,
        extra: { provider: "stripe", cause: "confirmation email skipped" },
      });
      return;
    }

    await this.emailService.sendPaymentConfirmed(
      {
        email: student.email,
        studentName: student.name,
        academyName: academy.name,
        amountCents: payment.amountCents,
        referenceMonth: payment.referenceMonth,
      },
      payment.id,
    );

    const owner = await this.userRepo.findById(academy.ownerId);
    if (!owner) {
      emitEvent("payment.webhook_unhandled", {
        reason: "OWNER_NOT_FOUND",
        academyId: meta.academyId,
        paymentId: payment.id,
        extra: { provider: "stripe", cause: "manager email skipped" },
      });
      return;
    }

    await this.emailService.sendStudentPaymentReceived(
      {
        email: owner.email,
        managerName: owner.name,
        academyName: academy.name,
        studentName: student.name,
        amountCents: payment.amountCents,
        referenceMonth: payment.referenceMonth,
        hasPixKey: !!academy.pixKey,
      },
      payment.id,
    );
  }
}
