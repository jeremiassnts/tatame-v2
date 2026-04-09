import Stripe from "stripe";
import type { IClassRepository } from "../class/class.repository.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { ISubscriptionPlanRepository } from "../subscription/subscription.repository.js";
import type { IManagerSubscriptionRepository } from "./manager-subscription.repository.js";
import type { IUserRepository } from "../user/user.repository.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { EmailService } from "../email/email.service.js";
import type { IPaymentRepository } from "../payment/payment.repository.js";
import { mapStripeStatus } from "./stripe-status.js";

const FREE_STUDENT_LIMIT = 50;
const FREE_PLAN_LIMIT = 1;
const FREE_DAILY_SCHEDULE_LIMIT = 2;

export class StripeWebhookHandler {
  constructor(
    private readonly subRepo: IManagerSubscriptionRepository,
    private readonly memRepo: IMembershipRepository,
    private readonly classRepo: IClassRepository,
    private readonly planRepo: ISubscriptionPlanRepository,
    private readonly userRepo: IUserRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly emailService: EmailService | null,
    private readonly paymentRepo: IPaymentRepository | null,
  ) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "customer.subscription.created":
        await this.onSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.updated":
        await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.paid":
        await this.onInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await this.onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case "checkout.session.completed":
        await this.onCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
    }
  }

  private getPeriodEndFromStripeSub(stripeSub: Stripe.Subscription): Date | null {
    const itemPeriodEnd = stripeSub.items?.data?.[0]?.current_period_end;
    const periodEndSeconds = itemPeriodEnd ?? stripeSub.cancel_at;

    if (typeof periodEndSeconds !== "number") return null;

    const d = new Date(periodEndSeconds * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private async resolveOwner(academyId: string) {
    const academy = await this.academyRepo.findById(academyId);
    if (!academy) return null;
    const owner = await this.userRepo.findById(academy.ownerId);
    if (!owner) return null;
    return { academy, owner };
  }

  private async onSubscriptionCreated(
    stripeSub: Stripe.Subscription,
  ): Promise<void> {
    const customerId =
      typeof stripeSub.customer === "string"
        ? stripeSub.customer
        : stripeSub.customer.id;

    const row = await this.subRepo.findByStripeCustomerId(customerId);
    if (!row) return;

    await this.subRepo.update(row.id, {
      plan: "pro",
      status: "active",
      stripeSubscriptionId: stripeSub.id,
      currentPeriodEnd: this.getPeriodEndFromStripeSub(stripeSub),
    });

    if (this.emailService) {
      const resolved = await this.resolveOwner(row.academyId);
      if (resolved) {
        await this.emailService.sendProActivated(
          {
            email: resolved.owner.email,
            managerName: resolved.owner.name,
            academyName: resolved.academy.name,
          },
          stripeSub.id,
        );
      }
    }
  }

  private async onSubscriptionUpdated(
    stripeSub: Stripe.Subscription,
  ): Promise<void> {
    const row = await this.subRepo.findByStripeSubscriptionId(stripeSub.id);
    if (!row) return;

    const newStatus = mapStripeStatus(stripeSub.status);

    const scheduledCancelAt =
      stripeSub.cancel_at != null
        ? new Date(stripeSub.cancel_at * 1000)
        : null;

    await this.subRepo.update(row.id, {
      status: newStatus,
      currentPeriodEnd: this.getPeriodEndFromStripeSub(stripeSub),
      canceledAt: stripeSub.canceled_at
        ? new Date(stripeSub.canceled_at * 1000)
        : scheduledCancelAt,
    });
  }

  private async onSubscriptionDeleted(
    stripeSub: Stripe.Subscription,
  ): Promise<void> {
    const row = await this.subRepo.findByStripeSubscriptionId(stripeSub.id);
    if (!row) return;

    const canDowngrade = await this.canDowngradeToFree(row.academyId);
    if (canDowngrade) {
      await this.subRepo.update(row.id, {
        plan: "free",
        status: "active",
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        canceledAt: null,
      });
    } else {
      await this.subRepo.update(row.id, {
        status: "canceled",
        canceledAt: new Date(),
      });
    }

    if (this.emailService) {
      const resolved = await this.resolveOwner(row.academyId);
      if (resolved) {
        const periodEnd = this.getPeriodEndFromStripeSub(stripeSub);
        await this.emailService.sendSubscriptionCanceled(
          {
            email: resolved.owner.email,
            managerName: resolved.owner.name,
            academyName: resolved.academy.name,
            endsAt: periodEnd
              ? periodEnd.toLocaleDateString("pt-BR")
              : "imediatamente",
          },
          stripeSub.id,
        );
      }
    }
  }

  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subRef = invoice.parent?.subscription_details?.subscription;
    const subId = typeof subRef === "string" ? subRef : subRef?.id;
    if (!subId) return;

    const row = await this.subRepo.findByStripeSubscriptionId(subId);
    if (!row) return;

    await this.subRepo.update(row.id, { status: "active" });

    if (this.emailService) {
      const resolved = await this.resolveOwner(row.academyId);
      if (resolved) {
        await this.emailService.sendInvoicePaid(
          {
            email: resolved.owner.email,
            managerName: resolved.owner.name,
            academyName: resolved.academy.name,
            amountCents: invoice.amount_paid ?? 0,
            invoiceUrl: invoice.hosted_invoice_url ?? undefined,
          },
          invoice.id,
        );
      }
    }
  }

  private async onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subRef = invoice.parent?.subscription_details?.subscription;
    const subId = typeof subRef === "string" ? subRef : subRef?.id;
    if (!subId) return;

    const row = await this.subRepo.findByStripeSubscriptionId(subId);
    if (!row) return;

    await this.subRepo.update(row.id, { status: "past_due" });

    if (this.emailService) {
      const resolved = await this.resolveOwner(row.academyId);
      if (resolved) {
        await this.emailService.sendPaymentFailed(
          {
            email: resolved.owner.email,
            managerName: resolved.owner.name,
            academyName: resolved.academy.name,
            amountCents: invoice.amount_due ?? 0,
          },
          invoice.id,
        );
      }
    }
  }

  private async onCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const meta = session.metadata;
    if (!meta?.subscriptionId || !meta.userId || !meta.academyId || !meta.referenceMonth) {
      return;
    }

    if (!this.paymentRepo) return;

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (paymentIntentId) {
      const existing = await this.paymentRepo.findByStripePaymentId(paymentIntentId);
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

  private async canDowngradeToFree(academyId: string): Promise<boolean> {
    const students = await this.memRepo.findByAcademy(academyId, {
      role: "student",
      status: "active",
    });
    if (students.length > FREE_STUDENT_LIMIT) return false;

    const plans = await this.planRepo.findByAcademy(academyId, {
      includeInactive: false,
    });
    if (plans.length > FREE_PLAN_LIMIT) return false;

    const instructors = await this.memRepo.findByAcademy(academyId, {
      role: "instructor",
      status: "active",
    });
    if (instructors.length > 0) return false;

    for (let day = 0; day <= 6; day++) {
      const classes = await this.classRepo.findByAcademyId(academyId, {
        dayOfWeek: day,
        includeInactive: false,
      });
      if (classes.length > FREE_DAILY_SCHEDULE_LIMIT) return false;
    }

    return true;
  }
}
