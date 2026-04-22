import Stripe from "stripe";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { EmailService } from "../email/email.service.js";
import type { NotificationDispatcher } from "../notification/notification-dispatcher.js";
import type { IUserRepository } from "../user/user.repository.js";
import type { IPaymentRepository } from "./payment.repository.js";

export class StripeCheckoutWebhookHandler {
  constructor(
    private readonly paymentRepo: IPaymentRepository,
    private readonly userRepo: IUserRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly emailService: EmailService | null,
    private readonly dispatcher?: NotificationDispatcher,
  ) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    if (event.type !== "checkout.session.completed") return;
    await this.onCheckoutSessionCompleted(
      event.data.object as Stripe.Checkout.Session,
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
      if (existing) return;
    }

    const payment = await this.paymentRepo.create({
      subscriptionId: meta.subscriptionId,
      userId: meta.userId,
      academyId: meta.academyId,
      amountCents: session.amount_total ?? 0,
      method: "stripe",
      confirmedBy: null,
      stripePaymentId: paymentIntentId ?? session.id,
      referenceMonth: meta.referenceMonth,
      notes: null,
      paidAt: new Date(),
    });

    // Push notifications
    if (this.dispatcher) {
      const student = await this.userRepo.findById(meta.userId);
      this.dispatcher.notifyUsers(
        "payment_confirmed",
        [meta.userId],
        ["assinatura"],
        { academyId: meta.academyId },
      );
      this.dispatcher.notifyAcademyManagers(
        "student_payment_received",
        meta.academyId,
        [student?.name ?? "Aluno", "assinatura"],
      );
    }

    if (!this.emailService) return;

    const student = await this.userRepo.findById(meta.userId);
    const academy = await this.academyRepo.findById(meta.academyId);
    if (!student || !academy) return;

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
    if (!owner) return;

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
