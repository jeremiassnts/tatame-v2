import { loadEnv } from "@tatame/config";
import type {
  AsaasClient,
  AsaasCompanyType,
  CreateAsaasAccountInput,
} from "../../lib/asaas.js";
import { encryptSecret } from "../../lib/crypto.js";
import { HttpError } from "../../lib/http-error.js";
import { emitEvent } from "../../telemetry/events.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type {
  IPayoutAccountRepository,
  PayoutAccountRow,
} from "./payout-account.repository.js";

/**
 * The academy's receiving account at Asaas.
 *
 * Everything here exists so a student payment can be split straight into the
 * academy's own wallet. That wallet only exists once Asaas has created and
 * approved a subaccount, which is why plan creation and enrollment gate on it.
 */

/** What the manager fills in on the onboarding form. */
export interface CreatePayoutAccountInput {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  incomeValue: number;
  address: string;
  addressNumber: string;
  province: string;
  postalCode: string;
  complement?: string;
  /** CPF accounts only. */
  birthDate?: string;
  /** CNPJ accounts only. */
  companyType?: AsaasCompanyType;
}

/**
 * The account as the app is allowed to see it — every column except the sealed
 * API key. Omitting it here, rather than at each route, is what keeps it from
 * leaking through a handler that forgot.
 */
export type PayoutAccountView = Omit<PayoutAccountRow, "apiKeyEncrypted">;

/** Injected so unit tests never reach the network. `AsaasClient` satisfies it. */
export interface AsaasClientFactory {
  root(): AsaasClient;
  forSubaccount(apiKey: string): AsaasClient;
}

/**
 * Registered on the subaccount at creation. Account-status events are how an
 * account reaches `approved` without anyone polling; the payment events cover
 * the credits the split produces on the academy's side.
 */
const ACCOUNT_STATUS_EVENTS = [
  "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED",
  "ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL",
  "ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING",
  "ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED",
  "ACCOUNT_STATUS_DOCUMENT_APPROVED",
  "ACCOUNT_STATUS_DOCUMENT_AWAITING_APPROVAL",
  "ACCOUNT_STATUS_DOCUMENT_PENDING",
  "ACCOUNT_STATUS_DOCUMENT_REJECTED",
  "ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED",
  "ACCOUNT_STATUS_COMMERCIAL_INFO_AWAITING_APPROVAL",
  "ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING",
  "ACCOUNT_STATUS_COMMERCIAL_INFO_REJECTED",
  "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED",
  "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_AWAITING_APPROVAL",
  "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_PENDING",
  "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_REJECTED",
];

const PAYMENT_EVENTS = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_REFUNDED"];

function isDuplicateAcademy(error: unknown): boolean {
  return (
    error instanceof Error &&
    /duplicate key|unique constraint/i.test(error.message) &&
    /academy_id/i.test(error.message)
  );
}

export function toPayoutAccountView(row: PayoutAccountRow): PayoutAccountView {
  const { apiKeyEncrypted: _apiKeyEncrypted, ...view } = row;
  return view;
}

export class PayoutAccountService {
  constructor(
    private readonly repo: IPayoutAccountRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly asaas: AsaasClientFactory,
  ) {}

  async get(
    managerUserId: string,
    academyId: string,
  ): Promise<PayoutAccountView | null> {
    await this.assertManagerOwnsAcademy(managerUserId, academyId);
    const row = await this.repo.findByAcademyId(academyId);
    return row ? toPayoutAccountView(row) : null;
  }

  async create(
    managerUserId: string,
    academyId: string,
    input: CreatePayoutAccountInput,
  ): Promise<PayoutAccountView> {
    await this.assertManagerOwnsAcademy(managerUserId, academyId);

    // Checked before anything reaches Asaas. A second subaccount there cannot
    // be undone from here, so the cheap local check has to come first.
    const existing = await this.repo.findByAcademyId(academyId);
    if (existing) {
      throw new HttpError(409, "Esta academia já possui uma conta de recebimento", {
        code: "PAYOUT_ACCOUNT_EXISTS",
      });
    }

    const webhooks = this.buildWebhooks(input.email);

    const account = await this.asaas.root().createAccount({
      ...input,
      webhooks,
    } satisfies CreateAsaasAccountInput);

    // Sealing before the insert means a misconfigured encryption key fails
    // while there is still nothing persisted to be inconsistent with.
    const apiKeyEncrypted = encryptSecret(account.apiKey);

    let row: PayoutAccountRow;
    try {
      row = await this.repo.create({
        academyId,
        externalAccountId: account.id,
        walletId: account.walletId,
        apiKeyEncrypted,
        status: "pending",
      });
    } catch (error) {
      // Two requests raced, or the first response was lost and the manager
      // retried. Either way the academy already has an account and this is a
      // conflict, not a server fault.
      if (isDuplicateAcademy(error)) {
        throw new HttpError(409, "Esta academia já possui uma conta de recebimento", {
          code: "PAYOUT_ACCOUNT_EXISTS",
        });
      }
      throw error;
    }

    emitEvent("payout_account.created", {
      userId: managerUserId,
      academyId,
      extra: { externalAccountId: account.id },
    });

    return toPayoutAccountView(row);
  }

  private buildWebhooks(email: string) {
    const env = loadEnv();
    if (!env.ASAAS_WEBHOOK_TOKEN) {
      throw new HttpError(503, "Integração de pagamentos não está configurada");
    }
    if (!env.API_PUBLIC_URL) {
      throw new HttpError(503, "Integração de pagamentos não está configurada");
    }
    const url = `${env.API_PUBLIC_URL.replace(/\/+$/, "")}/v1/webhooks/asaas`;

    // Two registrations rather than one: Asaas delivers per webhook, and
    // keeping the account-status stream separate means a payment backlog
    // cannot delay an approval the manager is waiting on.
    return [
      {
        name: "Tatame - situação da conta",
        events: ACCOUNT_STATUS_EVENTS,
      },
      {
        name: "Tatame - pagamentos",
        events: PAYMENT_EVENTS,
      },
    ].map((hook) => ({
      ...hook,
      url,
      email,
      enabled: true,
      interrupted: false,
      apiVersion: 3,
      authToken: env.ASAAS_WEBHOOK_TOKEN!,
      sendType: "SEQUENTIALLY" as const,
    }));
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
