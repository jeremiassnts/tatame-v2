import type { IPaymentRepository } from "./payment.repository.js";
import type { IUserRepository } from "../user/user.repository.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { EmailService } from "../email/email.service.js";

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
  ) {}

  async handleEvent(body: AbacatePayWebhookEvent): Promise<void> {
    if (body.event !== "billing.paid") return;

    const pixQrCodeId = body.data.pixQrCode?.id;
    if (!pixQrCodeId) return;

    // Look up metadata stored when the QR code was created
    const pending = await this.paymentRepo.findPendingPixByQrCodeId(pixQrCodeId);
    if (!pending) return;

    // Idempotency: check if payment already exists for this pixQrCodeId
    const existing = await this.paymentRepo.findByStripePaymentId(pixQrCodeId);
    if (existing) return;

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
    });

    // Clean up pending record
    await this.paymentRepo.deletePendingPix(pixQrCodeId);

    if (!this.emailService) return;

    const student = await this.userRepo.findById(pending.userId);
    const academy = await this.academyRepo.findById(pending.academyId);
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
