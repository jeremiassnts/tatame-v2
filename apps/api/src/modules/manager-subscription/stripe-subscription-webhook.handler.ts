import type Stripe from "stripe";
import { loadEnv } from "@tatame/config";
import type { SubscriptionWithPeriod } from "../../lib/stripe.js";
import type { IManagerSubscriptionRepository } from "./manager-subscription.repository.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { IUserRepository } from "../user/user.repository.js";
import type { EmailService } from "../email/email.service.js";
import { emitEvent } from "../../telemetry/events.js";
import { log } from "../../telemetry/logger.js";

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
        await this.onSubscriptionChange(
          event.data.object,
          true,
        );
        break;
      case "customer.subscription.updated":
        await this.onSubscriptionChange(
          event.data.object,
          false,
        );
        break;
      case "customer.subscription.deleted":
        await this.onSubscriptionDeleted(
          event.data.object,
        );
        break;
      case "invoice.paid":
        await this.onInvoicePaid(event.data.object);
        break;
      case "invoice.payment_failed":
        await this.onPaymentFailed(event.data.object);
        break;
      case "invoice.upcoming":
        await this.onInvoiceUpcoming(event.data.object);
        break;
      default:
        emitEvent("manager_subscription.webhook_unhandled", {
          reason: "UNKNOWN_EVENT_TYPE",
          extra: { type: event.type },
        });
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

  private async onSubscriptionChange(sub: Stripe.Subscription, isNew: boolean): Promise<void> {
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
      emitEvent("manager_subscription.activated", {
        subscriptionId: existing.id,
        stripeSubscriptionId: sub.id,
        extra: { status, cause: "subscription_updated" },
      });
      return;
    }

    // Case 2: No academy yet — store as pending on user record
    if (!clerkUserId) {
      emitEvent("manager_subscription.webhook_unhandled", {
        reason: "NO_ACADEMY_OR_USER",
        stripeSubscriptionId: sub.id,
      });
      return;
    }

    const user = await this.userRepo.findByClerkId(clerkUserId);
    if (!user) {
      emitEvent("manager_subscription.webhook_unhandled", {
        reason: "USER_NOT_FOUND",
        clerkUserId,
        stripeSubscriptionId: sub.id,
      });
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
      emitEvent("manager_subscription.activated", {
        userId: user.id,
        academyId: academy.id,
        stripeSubscriptionId: sub.id,
        extra: { cause: "linked_to_academy", isNew },
      });

      if (isNew && this.emailService) {
        await this.emailService.sendProActivated(
          {
            managerName: user.name,
            academyName: academy.name,
            email: user.email,
          },
          sub.id,
        );
        await this.notifyAdminNewManager(user.name, user.email, academy.name, sub.id);
      }
      return;
    }

    // No academy yet — store pending Stripe data on user
    await this.userRepo.updatePendingStripe(user.id, {
      pendingStripeCustomerId: stripeCustomerId,
      pendingStripeSubscriptionId: sub.id,
    });
    emitEvent("manager_subscription.activated", {
      userId: user.id,
      stripeSubscriptionId: sub.id,
      extra: { cause: "pending_no_academy", isNew },
    });

    // Send welcome email on new subscription
    if (isNew && this.emailService) {
      await this.emailService.sendProActivated(
        {
          managerName: user.name,
          academyName: user.name,
          email: user.email,
        },
        sub.id,
      );
      await this.notifyAdminNewManager(user.name, user.email, user.name, sub.id);
      log.info("pro-activated email sent", {
        component: "stripe-sub-webhook",
        userId: user.id,
      });
    }
  }

  private async notifyAdminNewManager(
    managerName: string,
    managerEmail: string,
    academyName: string,
    stripeSubscriptionId: string,
  ): Promise<void> {
    const adminEmail = loadEnv().ADMIN_EMAIL;
    if (!adminEmail || !this.emailService) return;

    await this.emailService.sendAdminNewManager(
      { managerName, managerEmail, academyName, email: adminEmail },
      stripeSubscriptionId,
    );
  }

  private async onSubscriptionDeleted(
    sub: Stripe.Subscription,
  ): Promise<void> {
    const existing = await this.subRepo.findByStripeSubscriptionId(sub.id);
    if (!existing) {
      emitEvent("manager_subscription.webhook_unhandled", {
        reason: "NO_RECORD",
        stripeSubscriptionId: sub.id,
        extra: { cause: "subscription_deleted" },
      });
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

    emitEvent("manager_subscription.canceled", {
      subscriptionId: existing.id,
      stripeSubscriptionId: sub.id,
    });
  }

  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subId = getInvoiceSubscriptionId(invoice);
    if (!subId) return;

    const existing = await this.subRepo.findByStripeSubscriptionId(subId);
    if (!existing) return;

    // Skip trial invoices with $0
    const amount = invoice.amount_paid ?? 0;
    if (amount === 0) return;

    if (!this.emailService) return;

    const academy = await this.acadRepo.findById(existing.academyId);
    if (!academy) return;

    await this.emailService.sendInvoicePaid(
      {
        managerName: academy.name,
        academyName: academy.name,
        amountCents: amount,
        invoiceUrl: invoice.hosted_invoice_url ?? undefined,
        email: academy.contactEmail ?? "",
      },
      invoice.id,
    );

    log.info("invoice paid email sent", {
      component: "stripe-sub-webhook",
      subscriptionId: existing.id,
      invoiceId: invoice.id,
    });
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

    emitEvent("manager_subscription.trial_ending", { subscriptionId: existing.id });
  }

  private async onPaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subId = getInvoiceSubscriptionId(invoice);
    if (!subId) return;

    const existing = await this.subRepo.findByStripeSubscriptionId(subId);
    if (!existing) return;

    await this.subRepo.update(existing.id, { status: "past_due" });

    emitEvent("manager_subscription.past_due", {
      reason: "PAYMENT_FAILED",
      subscriptionId: existing.id,
      extra: { invoiceId: invoice.id },
    });
  }
}
