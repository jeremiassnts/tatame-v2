import type { InferSelectModel } from "drizzle-orm";
import type { academyPayoutAccounts } from "@tatame/db";

export type PayoutAccountRow = InferSelectModel<typeof academyPayoutAccounts>;

export type PayoutAccountStatus = PayoutAccountRow["status"];

/** Everything Asaas hands back at creation that has to survive the request. */
export interface CreatePayoutAccountData {
  academyId: string;
  externalAccountId: string;
  walletId: string;
  /** Already sealed by `lib/crypto.ts` — this layer never sees plaintext. */
  apiKeyEncrypted: string;
  status: PayoutAccountStatus;
  generalStatus?: string | null;
  commercialInfoStatus?: string | null;
  documentStatus?: string | null;
  bankAccountInfoStatus?: string | null;
  onboardingUrl?: string | null;
}

export type UpdatePayoutAccountData = Partial<{
  status: PayoutAccountStatus;
  generalStatus: string | null;
  commercialInfoStatus: string | null;
  documentStatus: string | null;
  bankAccountInfoStatus: string | null;
  onboardingUrl: string | null;
  rejectionReason: string | null;
  approvedAt: Date | null;
}>;

export interface IPayoutAccountRepository {
  findByAcademyId(academyId: string): Promise<PayoutAccountRow | undefined>;

  /** An ACCOUNT_STATUS_* webhook identifies the account only by this id. */
  findByExternalAccountId(
    externalAccountId: string,
  ): Promise<PayoutAccountRow | undefined>;

  create(data: CreatePayoutAccountData): Promise<PayoutAccountRow>;

  update(
    id: string,
    data: UpdatePayoutAccountData,
  ): Promise<PayoutAccountRow | undefined>;
}
