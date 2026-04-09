import type { IPaymentRepository } from "./payment.repository.js";
import type { IUserRepository } from "../user/user.repository.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { EmailService } from "../email/email.service.js";

type BillingPaidEvent = {
  event: string;
  data: {
    payment: {
      amount: number;
      fee: number;
      method: string;
    };
    billing: {
      id: string;
      amount: number;
      paidAmount: number;
      status: string;
      products: Array<{
        externalId: string;
        id: string;
        quantity: number;
      }>;
      customer: {
        id: string;
        metadata: {
          email: string;
          name: string;
        };
      };
    };
  };
};

type PaymentMetadata = {
  subscriptionId: string;
  userId: string;
  academyId: string;
  referenceMonth: string;
};

export class AbacatePayWebhookHandler {
  constructor(
    private readonly paymentRepo: IPaymentRepository,
    private readonly userRepo: IUserRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly emailService: EmailService | null,
  ) {}

  async handleEvent(body: BillingPaidEvent): Promise<void> {
    if (body.event !== "billing.paid") return;

    const billing = body.data.billing;
    const product = billing.products[0];
    if (!product?.externalId) return;

    let meta: PaymentMetadata;
    try {
      meta = JSON.parse(product.externalId);
    } catch {
      return;
    }

    if (!meta.subscriptionId || !meta.userId || !meta.academyId || !meta.referenceMonth) {
      return;
    }

    // Idempotency: check if payment already exists for this billing
    const existing = await this.paymentRepo.findByStripePaymentId(billing.id);
    if (existing) return;

    const payment = await this.paymentRepo.create({
      subscriptionId: meta.subscriptionId,
      userId: meta.userId,
      academyId: meta.academyId,
      amountCents: billing.paidAmount ?? billing.amount,
      method: "pix",
      confirmedBy: null,
      stripePaymentId: billing.id,
      referenceMonth: meta.referenceMonth,
      notes: null,
      paidAt: new Date(),
    });

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
