import type Stripe from "stripe";
import { HttpError } from "../../lib/http-error.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { IClassRepository } from "../class/class.repository.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { ISubscriptionPlanRepository } from "../subscription/subscription.repository.js";
import type {
  IManagerSubscriptionRepository,
  ManagerSubscriptionRow,
} from "./manager-subscription.repository.js";
import { FREE_PLAN_LIMITS } from "./plan-limits.js";
import type { SubscriptionWithPeriod } from "../../lib/stripe.js";

/** Only the pending-Stripe fields `linkPendingSubscription` reads off a user row. */
type PendingStripeUser = {
  pendingStripeCustomerId?: string | null;
  pendingStripeSubscriptionId?: string | null;
};

export class ManagerSubscriptionService {
  constructor(
    private readonly subRepo: IManagerSubscriptionRepository,
    private readonly acadRepo: IAcademyRepository,
    private readonly stripe: Stripe | null = null,
    private readonly membershipRepo?: IMembershipRepository,
    private readonly planRepo?: ISubscriptionPlanRepository,
    private readonly classRepo?: IClassRepository,
  ) {}

  async getSubscription(
    academyId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    return this.subRepo.findByAcademyId(academyId);
  }

  async isSubscriptionActive(academyId: string): Promise<boolean> {
    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub) return false;
    return sub.status === "active" || sub.status === "trialing";
  }

  async createCheckoutSession(
    clerkUserId: string,
    email: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<string> {
    if (!this.stripe) throw new HttpError(503, "Stripe not configured");

    // Create or reuse Stripe customer (required for Accounts V2)
    const existing = await this.stripe.customers.list({ email, limit: 1 });
    const customer = existing.data[0] ?? await this.stripe.customers.create({
      email,
      metadata: { clerkUserId },
    });

    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 30,
        metadata: { clerkUserId },
      },
      metadata: { clerkUserId },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return session.url!;
  }

  /**
   * Called when a manager creates an academy in the app.
   * Checks if the user has pending Stripe subscription data and links it.
   */
  async linkPendingSubscription(
    userId: string,
    academyId: string,
    userRepo: {
      findById(id: string): Promise<PendingStripeUser | undefined>;
      clearPendingStripe(id: string): Promise<void>;
    },
  ): Promise<void> {
    if (!this.stripe) return;

    const user = await userRepo.findById(userId);
    if (!user?.pendingStripeCustomerId || !user?.pendingStripeSubscriptionId) return;

    const stripeSub = await this.stripe.subscriptions.retrieve(
      user.pendingStripeSubscriptionId,
    );

    const currentPeriodEnd = (stripeSub as unknown as SubscriptionWithPeriod).current_period_end;
    const trialEnd = stripeSub.trial_end;

    await this.subRepo.upsertByAcademy({
      academyId,
      plan: "pro",
      status: this.mapStripeStatus(stripeSub.status),
      stripeCustomerId: user.pendingStripeCustomerId,
      stripeSubscriptionId: user.pendingStripeSubscriptionId,
      stripePriceId: stripeSub.items.data[0]?.price.id ?? null,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
      trialEndsAt: trialEnd ? new Date(trialEnd * 1000) : null,
    });

    await userRepo.clearPendingStripe(userId);
  }

  private mapStripeStatus(
    status: string,
  ): "active" | "trialing" | "past_due" | "canceled" | "incomplete" {
    switch (status) {
      case "active": return "active";
      case "trialing": return "trialing";
      case "past_due": return "past_due";
      case "canceled":
      case "unpaid": return "canceled";
      default: return "incomplete";
    }
  }

  async cancelSubscription(academyId: string): Promise<void> {
    if (!this.stripe) throw new HttpError(503, "Stripe not configured");

    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub?.stripeSubscriptionId) {
      throw new HttpError(404, "No active subscription found");
    }

    await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await this.subRepo.update(sub.id, {
      canceledAt: new Date(),
    });
  }

  async reactivateSubscription(academyId: string): Promise<void> {
    if (!this.stripe) throw new HttpError(503, "Stripe not configured");

    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub?.stripeSubscriptionId) {
      throw new HttpError(404, "No subscription found");
    }

    await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    await this.subRepo.update(sub.id, {
      canceledAt: null,
    });
  }

  async createFree(academyId: string): Promise<ManagerSubscriptionRow> {
    const existing = await this.subRepo.findByAcademyId(academyId);
    if (existing) {
      throw new HttpError(409, "Uma conta já existe para esta academia.");
    }

    return this.subRepo.create({
      academyId,
      plan: "free",
      status: "active",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null,
      trialEndsAt: null,
    });
  }

  async getLimits(academyId: string) {
    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub) {
      return {
        plan: "free" as const,
        blocked: false,
        students: { used: 0, limit: FREE_PLAN_LIMITS.maxStudents },
        instructors: { used: 0, limit: FREE_PLAN_LIMITS.maxInstructors },
        plans: { used: 0, limit: FREE_PLAN_LIMITS.maxPlans },
        schedulesPerDay: { maxUsed: 0, limit: FREE_PLAN_LIMITS.maxClassesPerDay },
      };
    }

    const isFree = sub.plan === "free";
    const isBlocked = sub.status === "canceled" || sub.status === "past_due";

    const studentCount = this.membershipRepo
      ? (await this.membershipRepo.findByAcademy(academyId, { role: "student", status: "active" })).length
      : 0;

    const instructorCount = this.membershipRepo
      ? (await this.membershipRepo.findByAcademy(academyId, { role: "instructor", status: "active" })).length
      : 0;

    const planCount = this.planRepo
      ? (await this.planRepo.findByAcademy(academyId, { includeInactive: false })).length
      : 0;

    let maxClassesOnAnyDay = 0;
    if (this.classRepo) {
      for (let day = 0; day < 7; day++) {
        const classes = await this.classRepo.findByAcademyId(academyId, {
          dayOfWeek: day,
          includeInactive: false,
        });
        if (classes.length > maxClassesOnAnyDay) {
          maxClassesOnAnyDay = classes.length;
        }
      }
    }

    return {
      plan: sub.plan,
      blocked: isBlocked,
      students: {
        used: studentCount,
        limit: isFree ? FREE_PLAN_LIMITS.maxStudents : null,
      },
      instructors: {
        used: instructorCount,
        limit: isFree ? FREE_PLAN_LIMITS.maxInstructors : null,
      },
      plans: {
        used: planCount,
        limit: isFree ? FREE_PLAN_LIMITS.maxPlans : null,
      },
      schedulesPerDay: {
        maxUsed: maxClassesOnAnyDay,
        limit: isFree ? FREE_PLAN_LIMITS.maxClassesPerDay : null,
      },
    };
  }

  async createBillingPortalSession(
    academyId: string,
    returnUrl: string,
  ): Promise<string> {
    if (!this.stripe) throw new HttpError(503, "Stripe not configured");

    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub?.stripeCustomerId) {
      throw new HttpError(404, "No subscription found");
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: returnUrl,
    });

    return session.url;
  }
}
