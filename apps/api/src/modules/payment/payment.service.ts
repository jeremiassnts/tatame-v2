import type { ConfirmManualPaymentBody } from "@tatame/validators";
import type Stripe from "stripe";
import { HttpError } from "../../lib/http-error.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { IStudentSubscriptionRepository } from "../subscription/subscription.repository.js";
import type {
  IPaymentRepository,
  PaymentRow,
  PaymentWithUser,
} from "./payment.repository.js";

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
      stripePaymentId: null,
      referenceMonth: body.referenceMonth,
      notes: body.notes ?? null,
      paidAt,
    });
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

  async createCheckoutSession(
    studentUserId: string,
    academyId: string,
    stripe: Stripe,
    opts?: { subscriptionId?: string },
  ): Promise<{ checkoutUrl: string }> {
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
      },
      success_url: `tatame://payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: "tatame://payment-cancel",
    });

    if (!session.url) {
      throw new HttpError(500, "Failed to create checkout session");
    }

    return { checkoutUrl: session.url };
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
