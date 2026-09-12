import { emitEvent } from "../../telemetry/events.js";
import type { AsaasRegistrationStatus } from "../../lib/asaas.js";
import type { IPayoutAccountRepository } from "./payout-account.repository.js";
import type { PayoutAccountService } from "./payout-account.service.js";

/**
 * The `ACCOUNT_STATUS_*` deliveries from Asaas.
 *
 * This is how an academy reaches `approved` without anyone polling, and it is
 * the only signal that an approved account has been blocked afterwards. A
 * delivery that cannot be applied is reported rather than dropped: silence
 * here looks exactly like an onboarding the manager simply has not finished.
 */

export interface AsaasAccountStatusEvent {
  id?: string;
  event?: string;
  dateCreated?: string;
  account?: { id?: string; ownerId?: string | null };
  accountStatus?: {
    id?: string;
    commercialInfo?: AsaasRegistrationStatus;
    bankAccountInfo?: AsaasRegistrationStatus;
    documentation?: AsaasRegistrationStatus;
    general?: AsaasRegistrationStatus;
  };
}

export const ACCOUNT_STATUS_EVENT_PREFIX = "ACCOUNT_STATUS_";

export class AsaasAccountWebhookHandler {
  constructor(
    private readonly repo: IPayoutAccountRepository,
    private readonly service: PayoutAccountService,
  ) {}

  async handleEvent(event: AsaasAccountStatusEvent): Promise<void> {
    if (!event.event?.startsWith(ACCOUNT_STATUS_EVENT_PREFIX)) {
      emitEvent("payout_account.webhook_unhandled", {
        reason: "UNKNOWN_EVENT_TYPE",
        extra: { type: event.event ?? "(missing)" },
      });
      return;
    }

    const externalAccountId = event.account?.id;
    if (!externalAccountId) {
      emitEvent("payout_account.webhook_unhandled", {
        reason: "MISSING_REFERENCE",
        extra: { type: event.event },
      });
      return;
    }

    const row = await this.repo.findByExternalAccountId(externalAccountId);
    if (!row) {
      // A subaccount at Asaas with no row here — created by a request whose
      // response was lost, or belonging to another environment sharing the
      // webhook url. Either way somebody has to look.
      emitEvent("payout_account.webhook_unhandled", {
        reason: "ACCOUNT_NOT_FOUND",
        extra: { type: event.event, externalAccountId },
      });
      return;
    }

    const status = event.accountStatus;
    if (
      !status?.general ||
      !status.commercialInfo ||
      !status.bankAccountInfo ||
      !status.documentation
    ) {
      // Applying a partial payload would overwrite known areas with nulls and
      // silently change the derived status.
      emitEvent("payout_account.webhook_unhandled", {
        reason: "MISSING_STATUS",
        academyId: row.academyId,
        extra: { type: event.event },
      });
      return;
    }

    const wasApproved = row.status === "approved";
    const updated = await this.service.applyAsaasStatus(row, {
      general: status.general,
      commercialInfo: status.commercialInfo,
      bankAccountInfo: status.bankAccountInfo,
      documentation: status.documentation,
    });

    if (updated.status === "approved" && !wasApproved) {
      emitEvent("payout_account.approved", {
        academyId: row.academyId,
        extra: { externalAccountId },
      });
    }
    if (updated.status === "suspended" && wasApproved) {
      emitEvent("payout_account.suspended", {
        reason: "GENERAL_APPROVAL_LOST",
        academyId: row.academyId,
        extra: { externalAccountId, general: status.general },
      });
    }
  }
}
