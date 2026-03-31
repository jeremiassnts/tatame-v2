import Stripe from "stripe";
import type { IClassRepository } from "../class/class.repository.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { ISubscriptionPlanRepository } from "../subscription/subscription.repository.js";
import type { IManagerSubscriptionRepository } from "./manager-subscription.repository.js";

const FREE_STUDENT_LIMIT = 50;
const FREE_PLAN_LIMIT = 1;
const FREE_DAILY_SCHEDULE_LIMIT = 2;

export class StripeWebhookHandler {
  constructor(
    private readonly subRepo: IManagerSubscriptionRepository,
    private readonly memRepo: IMembershipRepository,
    private readonly classRepo: IClassRepository,
    private readonly planRepo: ISubscriptionPlanRepository,
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
    }
  }

  private getPeriodEndFromStripeSub(stripeSub: Stripe.Subscription): Date | null {
    const root = (stripeSub as any).current_period_end as number | undefined;
    const item = (stripeSub as any).items?.data?.[0]?.current_period_end as
      | number
      | undefined;
    const cancelAt = (stripeSub as any).cancel_at as number | null | undefined;

    const periodEndSeconds =
      typeof root === "number"
        ? root
        : typeof item === "number"
          ? item
          : typeof cancelAt === "number"
            ? cancelAt
            : undefined;

    if (typeof periodEndSeconds !== "number") return null;

    const d = new Date(periodEndSeconds * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
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
  }

  private async onSubscriptionUpdated(
    stripeSub: Stripe.Subscription,
  ): Promise<void> {
    const row = await this.subRepo.findByStripeSubscriptionId(stripeSub.id);
    if (!row) return;

    const statusMap: Record<
      string,
      "active" | "past_due" | "canceled" | "incomplete"
    > = {
      active: "active",
      past_due: "past_due",
      canceled: "canceled",
      incomplete: "incomplete",
      incomplete_expired: "canceled",
      trialing: "active",
      unpaid: "past_due",
      paused: "past_due",
    };

    const newStatus = statusMap[stripeSub.status] ?? "active";

    const cancelAtSeconds = (stripeSub as any).cancel_at as
      | number
      | null
      | undefined;
    const scheduledCancelAt =
      typeof cancelAtSeconds === "number"
        ? new Date(cancelAtSeconds * 1000)
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
  }

  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subscription = (invoice as any).subscription as
      | string
      | { id: string }
      | null
      | undefined;
    const subId = typeof subscription === "string" ? subscription : subscription?.id;
    if (!subId) return;

    const row = await this.subRepo.findByStripeSubscriptionId(subId);
    if (!row) return;

    await this.subRepo.update(row.id, { status: "active" });
  }

  private async onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscription = (invoice as any).subscription as
      | string
      | { id: string }
      | null
      | undefined;
    const subId = typeof subscription === "string" ? subscription : subscription?.id;
    if (!subId) return;

    const row = await this.subRepo.findByStripeSubscriptionId(subId);
    if (!row) return;

    await this.subRepo.update(row.id, { status: "past_due" });
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

