import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { EmailService } from "../email/email.service.js";
import type { IUserRepository } from "../user/user.repository.js";
import { logger } from "../../lib/logger.js";
import type { IManagerSubscriptionRepository } from "./manager-subscription.repository.js";
import { mapStoreToDb, type RevenueCatEvent } from "./revenuecat-events.js";

export class RevenueCatWebhookHandler {
  constructor(
    private readonly subRepo: IManagerSubscriptionRepository,
    private readonly userRepo: IUserRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly emailService: EmailService | null,
  ) {}

  async handleEvent(payload: RevenueCatEvent): Promise<void> {
    const { event } = payload;

    logger.info(
      {
        type: event.type,
        app_user_id: event.app_user_id,
        product_id: event.product_id,
        original_transaction_id: event.original_transaction_id,
        environment: event.environment,
      },
      "[revenuecat] webhook event received",
    );

    switch (event.type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "PRODUCT_CHANGE":
        await this.onPurchase(payload, event.type === "INITIAL_PURCHASE");
        break;
      case "CANCELLATION":
        await this.onCancellation(payload);
        break;
      case "UNCANCELLATION":
        await this.onUncancellation(payload);
        break;
      case "EXPIRATION":
      case "REFUND":
        await this.onExpiration(payload);
        break;
      case "BILLING_ISSUE":
      case "SUBSCRIPTION_PAUSED":
        await this.onBillingIssue(payload);
        break;
      default:
        // TEST, TRANSFER, SUBSCRIBER_ALIAS, NON_RENEWING_PURCHASE — ignore.
        break;
    }
  }

  private async resolveAcademyForUser(appUserId: string) {
    const user = await this.userRepo.findById(appUserId);
    if (!user) {
      logger.warn({ appUserId }, "[revenuecat] user not found for app_user_id");
      return null;
    }
    const academies = await this.academyRepo.findByOwnerId(user.id);
    const academy = academies?.[0];
    if (!academy) {
      logger.warn({ userId: user.id }, "[revenuecat] no owned academy for user");
      return null;
    }
    return { user, academy };
  }

  private async onPurchase(
    payload: RevenueCatEvent,
    isInitial: boolean,
  ): Promise<void> {
    const { event } = payload;
    const ctx = await this.resolveAcademyForUser(event.app_user_id);
    if (!ctx) return;

    const currentPeriodEnd =
      typeof event.expiration_at_ms === "number"
        ? new Date(event.expiration_at_ms)
        : null;

    const row = await this.subRepo.upsertByAcademy({
      academyId: ctx.academy.id,
      plan: "pro",
      status: "active",
      revenuecatAppUserId: event.app_user_id,
      productId: event.product_id ?? null,
      originalTransactionId: event.original_transaction_id ?? null,
      store: mapStoreToDb(event.store),
      currentPeriodEnd,
      canceledAt: null,
      subscribedAt: isInitial ? new Date(event.event_timestamp_ms) : undefined,
    });

    if (isInitial && this.emailService) {
      await this.emailService.sendProActivated(
        {
          email: ctx.user.email,
          managerName: ctx.user.name,
          academyName: ctx.academy.name,
        },
        row.originalTransactionId ?? row.id,
      );
    }
  }

  private async onCancellation(_payload: RevenueCatEvent): Promise<void> {
    // Implemented in Task 10.
  }

  private async onUncancellation(_payload: RevenueCatEvent): Promise<void> {
    // Implemented in Task 10.
  }

  private async onExpiration(_payload: RevenueCatEvent): Promise<void> {
    // Implemented in Task 11.
  }

  private async onBillingIssue(_payload: RevenueCatEvent): Promise<void> {
    // Implemented in Task 11.
  }
}
