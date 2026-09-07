import type Stripe from "stripe";
import { loadEnv } from "@tatame/config";
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
        console.log("[stripe-sub-webhook] unhandled event type", { type: event.type });
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
      console.log("[stripe-sub-webhook] subscription updated", {
        subscriptionId: existing.id,
        status,
      });
      return;
    }

    // Case 2: No academy yet — store as pending on user record
    if (!clerkUserId) {
      console.warn("[stripe-sub-webhook] no academy and no clerkUserId in metadata", {
        stripeSubscriptionId: sub.id,
      });
      return;
    }

    const user = await this.userRepo.findByClerkId(clerkUserId);
    if (!user) {
      console.warn("[stripe-sub-webhook] user not found for clerkUserId", { clerkUserId });
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
      console.log("[stripe-sub-webhook] subscription linked to existing academy", {
        academyId: academy.id,
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
    console.log("[stripe-sub-webhook] stored pending Stripe data on user (no academy yet)", {
      userId: user.id,
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
      console.log("[stripe-sub-webhook] pro-activated email sent", { userId: user.id });
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
      console.warn("[stripe-sub-webhook] subscription.deleted — no record found", {
        stripeSubscriptionId: sub.id,
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

    console.log("[stripe-sub-webhook] subscription canceled", { subscriptionId: existing.id });
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

    console.log("[stripe-sub-webhook] invoice paid email sent", {
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

    console.log("[stripe-sub-webhook] trial ending email sent", { subscriptionId: existing.id });
  }

  private async onPaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subId = getInvoiceSubscriptionId(invoice);
    if (!subId) return;

    const existing = await this.subRepo.findByStripeSubscriptionId(subId);
    if (!existing) return;

    await this.subRepo.update(existing.id, { status: "past_due" });

    console.log("[stripe-sub-webhook] payment failed — marked past_due", {
      subscriptionId: existing.id,
    });
  }
}
