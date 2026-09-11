import type { IPaymentRepository } from "./payment.repository.js";
import type { IUserRepository } from "../user/user.repository.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { IStudentSubscriptionRepository } from "../subscription/subscription.repository.js";
import type { EmailService } from "../email/email.service.js";
import type { NotificationDispatcher } from "../notification/notification-dispatcher.js";
import { emitEvent } from "../../telemetry/events.js";

type AbacatePayWebhookEvent = {
  event: string;
  data: {
    pixQrCode?: {
      id: string;
      amount: number;
      kind: string;
      status: string;
    };
    payment?: {
      amount: number;
      fee: number;
      method: string;
    };
  };
};

export class AbacatePayWebhookHandler {
  constructor(
    private readonly paymentRepo: IPaymentRepository,
    private readonly userRepo: IUserRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly emailService: EmailService | null,
    private readonly dispatcher?: NotificationDispatcher,
    private readonly studentSubRepo?: IStudentSubscriptionRepository,
  ) {}

  async handleEvent(body: AbacatePayWebhookEvent): Promise<void> {
    if (body.event !== "billing.paid") {
      // Reported, unlike the equivalent branch in the Stripe handler, because
      // this endpoint is AbacatePay's alone — nothing else reports what arrives
      // here, so without this line "which AbacatePay events do we actually
      // receive?" has no answer. It is the one reason the alert rule filters
      // out: normal traffic, not a problem.
      emitEvent("payment.webhook_unhandled", {
        reason: "UNKNOWN_EVENT_TYPE",
        extra: { provider: "abacatepay", type: body.event },
      });
      return;
    }

    const pixQrCodeId = body.data.pixQrCode?.id;
    if (!pixQrCodeId) {
      emitEvent("payment.webhook_unhandled", {
        reason: "MISSING_REFERENCE",
        extra: { provider: "abacatepay", cause: "no pixQrCode.id on billing.paid" },
      });
      return;
    }

    // Look up metadata stored when the QR code was created
    const pending = await this.paymentRepo.findPendingPixByQrCodeId(pixQrCodeId);
    if (!pending) {
      // The expensive one. A Pix was paid and there is no pending row to attach
      // it to, so no payment is recorded and the student stays overdue. Nothing
      // downstream will notice — the route still answers 200 and AbacatePay
      // considers the webhook delivered.
      emitEvent("payment.webhook_unhandled", {
        reason: "NO_PENDING_PIX",
        extra: { provider: "abacatepay", pixQrCodeId },
      });
      return;
    }

    // Idempotency: check if payment already exists for this pixQrCodeId
    const existing = await this.paymentRepo.findByStripePaymentId(pixQrCodeId);
    // Deliberately not reported. A provider retrying a webhook it already
    // delivered is the system working, not a drop.
    if (existing) return;

    // Resolve dependentId from the subscription
    let dependentId: string | null = null;
    if (this.studentSubRepo) {
      const subResult = await this.studentSubRepo.findByIdWithPlan(pending.subscriptionId);
      dependentId = subResult?.subscription.dependentId ?? null;
    }

    const payment = await this.paymentRepo.create({
      subscriptionId: pending.subscriptionId,
      userId: pending.userId,
      academyId: pending.academyId,
      amountCents: body.data.pixQrCode?.amount ?? pending.amountCents,
      method: "pix",
      confirmedBy: null,
      stripePaymentId: pixQrCodeId,
      referenceMonth: pending.referenceMonth,
      notes: null,
      paidAt: new Date(),
      dependentId,
    });

    emitEvent("payment.confirmed", {
      userId: payment.userId,
      academyId: payment.academyId,
      paymentId: payment.id,
      subscriptionId: payment.subscriptionId,
      extra: { method: "pix", amountCents: payment.amountCents },
    });

    // Clean up pending record
    await this.paymentRepo.deletePendingPix(pixQrCodeId);

    // Push notifications
    if (this.dispatcher) {
      const student = await this.userRepo.findById(pending.userId);
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

    const student = await this.userRepo.findById(pending.userId);
    const academy = await this.academyRepo.findById(pending.academyId);
    if (!student || !academy) {
      // Softer than the drops above: the payment is recorded, only its emails
      // are skipped. Still a referential hole worth knowing about.
      emitEvent("payment.webhook_unhandled", {
        reason: "USER_OR_ACADEMY_NOT_FOUND",
        userId: pending.userId,
        academyId: pending.academyId,
        paymentId: payment.id,
        extra: { provider: "abacatepay", cause: "confirmation email skipped" },
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
        academyId: pending.academyId,
        paymentId: payment.id,
        extra: { provider: "abacatepay", cause: "manager email skipped" },
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
