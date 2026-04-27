import type Stripe from "stripe";
import { logger } from "../../lib/logger.js";
import type { IManagerSubscriptionRepository } from "./manager-subscription.repository.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { IUserRepository } from "../user/user.repository.js";
import type { EmailService } from "../email/email.service.js";

/**
 * Stripe v21 removed `current_period_end` from the Subscription type (new billing
 * mode), but the field is still present in webhook payloads for subscriptions that
 * use the legacy/fixed billing mode.  We cast to an intersection type to keep strict
 * typing everywhere else while still being able to read it here.
 */
type SubscriptionWithPeriod = Stripe.Subscription & {
  current_period_end: number;
};

/**
 * Returns the subscription ID referenced by a Stripe Invoice.
 *
 * In Stripe API v21+ the top-level `invoice.subscription` field was replaced by
 * `invoice.parent.subscription_details.subscription`.
 */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const ref = invoice.parent?.subscription_details?.subscription;
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

export class StripeSubscriptionWebhookHandler {
  constructor(
    private readonly subRepo: IManagerSubscriptionRepository,
    private readonly acadRepo: IAcademyRepository,
    private readonly userRepo: IUserRepository,
    private readonly emailService: EmailService | null,
  ) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await this.onSubscriptionChange(
          event.data.object as Stripe.Subscription,
        );
        break;
      case "customer.subscription.deleted":
        await this.onSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      case "invoice.payment_failed":
        await this.onPaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case "invoice.upcoming":
        await this.onInvoiceUpcoming(event.data.object as Stripe.Invoice);
        break;
      default:
        logger.info(
          { type: event.type },
          "[stripe-sub-webhook] unhandled event type",
        );
    }
  }

  private mapStatus(
    stripeStatus: Stripe.Subscription.Status,
  ): "active" | "trialing" | "past_due" | "canceled" | "incomplete" {
    switch (stripeStatus) {
      case "active":
        return "active";
      case "trialing":
        return "trialing";
      case "past_due":
        return "past_due";
      case "canceled":
      case "unpaid":
        return "canceled";
      case "incomplete":
      case "incomplete_expired":
        return "incomplete";
      default:
        return "incomplete";
    }
  }

  private async onSubscriptionChange(sub: Stripe.Subscription): Promise<void> {
    const stripeCustomerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const clerkUserId = sub.metadata?.clerkUserId;
    const s = sub as SubscriptionWithPeriod;

    // Case 1: Subscription already linked to an academy
    const existing =
      (await this.subRepo.findByStripeSubscriptionId(sub.id)) ??
      (await this.subRepo.findByStripeCustomerId(stripeCustomerId));

    if (existing) {
      const status = this.mapStatus(sub.status);
      await this.subRepo.update(existing.id, {
        plan: "pro",
        status,
        stripeSubscriptionId: sub.id,
        stripeCustomerId,
        stripePriceId: sub.items.data[0]?.price.id ?? null,
        currentPeriodEnd: new Date(s.current_period_end * 1000),
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        canceledAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
      });
      logger.info(
        { subscriptionId: existing.id, status },
        "[stripe-sub-webhook] subscription updated",
      );
      return;
    }

    // Case 2: No academy yet — store as pending on user record
    if (!clerkUserId) {
      logger.warn(
        { stripeSubscriptionId: sub.id },
        "[stripe-sub-webhook] no academy and no clerkUserId in metadata",
      );
      return;
    }

    const user = await this.userRepo.findByClerkId(clerkUserId);
    if (!user) {
      logger.warn(
        { clerkUserId },
        "[stripe-sub-webhook] user not found for clerkUserId",
      );
      return;
    }

    // Check if user already has an academy (race condition: academy created between checkout and webhook)
    const academies = await this.acadRepo.findByOwnerId(user.id);
    const academy = academies[0];
    if (academy) {
      // Link subscription to academy now
      await this.subRepo.upsertByAcademy({
        academyId: academy.id,
        plan: "pro",
        status: this.mapStatus(sub.status),
        stripeCustomerId,
        stripeSubscriptionId: sub.id,
        stripePriceId: sub.items.data[0]?.price.id ?? null,
        currentPeriodEnd: new Date(s.current_period_end * 1000),
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      });
      logger.info(
        { academyId: academy.id },
        "[stripe-sub-webhook] subscription linked to existing academy",
      );
      return;
    }

    // No academy yet — store pending Stripe data on user
    await this.userRepo.updatePendingStripe(user.id, {
      pendingStripeCustomerId: stripeCustomerId,
      pendingStripeSubscriptionId: sub.id,
    });
    logger.info(
      { userId: user.id },
      "[stripe-sub-webhook] stored pending Stripe data on user (no academy yet)",
    );
  }

  private async onSubscriptionDeleted(
    sub: Stripe.Subscription,
  ): Promise<void> {
    const existing = await this.subRepo.findByStripeSubscriptionId(sub.id);
    if (!existing) {
      logger.warn(
        { stripeSubscriptionId: sub.id },
        "[stripe-sub-webhook] subscription.deleted — no record found",
      );
      return;
    }

    await this.subRepo.update(existing.id, {
      status: "canceled",
      canceledAt: new Date(),
    });

    if (this.emailService) {
      const academy = await this.acadRepo.findById(existing.academyId);
      if (academy) {
        await this.emailService.sendSubscriptionCanceled(
          {
            managerName: academy.name,
            academyName: academy.name,
            endsAt: existing.currentPeriodEnd
              ? existing.currentPeriodEnd.toLocaleDateString("pt-BR")
              : new Date().toLocaleDateString("pt-BR"),
            email: academy.contactEmail ?? "",
          },
          sub.id,
        );
      }
    }

    logger.info(
      { subscriptionId: existing.id },
      "[stripe-sub-webhook] subscription canceled",
    );
  }

  private async onInvoiceUpcoming(invoice: Stripe.Invoice): Promise<void> {
    const subId = getInvoiceSubscriptionId(invoice);
    if (!subId) return;

    const existing = await this.subRepo.findByStripeSubscriptionId(subId);
    if (!existing) return;

    // Only notify if subscription is trialing (first charge coming)
    if (existing.status !== "trialing") return;

    if (!this.emailService) return;

    const academy = await this.acadRepo.findById(existing.academyId);
    if (!academy) return;

    const trialEndsAt = existing.trialEndsAt
      ? existing.trialEndsAt.toLocaleDateString("pt-BR")
      : new Date().toLocaleDateString("pt-BR");

    await this.emailService.sendTrialEnding(
      {
        managerName: academy.name,
        academyName: academy.name,
        trialEndsAt,
        portalUrl: process.env.MANAGER_PORTAL_URL ?? "https://tatame.app/conta",
        email: academy.contactEmail ?? "",
      },
      subId,
    );

    logger.info(
      { subscriptionId: existing.id },
      "[stripe-sub-webhook] trial ending email sent",
    );
  }

  private async onPaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subId = getInvoiceSubscriptionId(invoice);
    if (!subId) return;

    const existing = await this.subRepo.findByStripeSubscriptionId(subId);
    if (!existing) return;

    await this.subRepo.update(existing.id, { status: "past_due" });

    logger.info(
      { subscriptionId: existing.id },
      "[stripe-sub-webhook] payment failed — marked past_due",
    );
  }
}
