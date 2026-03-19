import type { ConfirmManualPaymentBody } from "@tatame/validators";
import { HttpError } from "../../lib/http-error.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { IStudentSubscriptionRepository } from "../subscription/subscription.repository.js";
import type { IPaymentRepository, PaymentRow } from "./payment.repository.js";

export class PaymentService {
  constructor(
    private readonly paymentRepo: IPaymentRepository,
    private readonly studentSubRepo: IStudentSubscriptionRepository,
    private readonly academyRepo: IAcademyRepository,
  ) {}

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

    return this.paymentRepo.create({
      subscriptionId: sub.subscription.id,
      userId: sub.subscription.userId,
      academyId,
      amountCents: body.amountCents,
      method: "manual",
      confirmedBy: managerUserId,
      referenceMonth: body.referenceMonth,
      notes: body.notes ?? null,
      paidAt,
    });
  }

  async listForManager(
    managerUserId: string,
    academyId: string,
    opts: { subscriptionId?: string },
  ): Promise<PaymentRow[]> {
    await this.assertManagerOwnsAcademy(managerUserId, academyId);
    return this.paymentRepo.findByAcademy(academyId, {
      subscriptionId: opts.subscriptionId,
    });
  }

  async listForStudent(
    studentUserId: string,
    academyId: string,
  ): Promise<PaymentRow[]> {
    return this.paymentRepo.findByAcademy(academyId, { userId: studentUserId });
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
