import { randomUUID } from "node:crypto";
import type {
  CreatePayoutAccountData,
  IPayoutAccountRepository,
  PayoutAccountRow,
  UpdatePayoutAccountData,
} from "./payout-account.repository.js";

export class InMemoryPayoutAccountRepository
  implements IPayoutAccountRepository
{
  constructor(public readonly rows: PayoutAccountRow[] = []) {}

  async findByAcademyId(
    academyId: string,
  ): Promise<PayoutAccountRow | undefined> {
    return this.rows.find((r) => r.academyId === academyId);
  }

  async findByExternalAccountId(
    externalAccountId: string,
  ): Promise<PayoutAccountRow | undefined> {
    return this.rows.find((r) => r.externalAccountId === externalAccountId);
  }

  async create(data: CreatePayoutAccountData): Promise<PayoutAccountRow> {
    // The unique constraint is the real guard against a duplicate account, so
    // the fake has to enforce it too or the 409 path is never exercised.
    if (this.rows.some((r) => r.academyId === data.academyId)) {
      throw new Error(
        'duplicate key value violates unique constraint "academy_payout_accounts_academy_id_unique"',
      );
    }
    const now = new Date();
    const row: PayoutAccountRow = {
      id: randomUUID(),
      academyId: data.academyId,
      provider: "asaas",
      externalAccountId: data.externalAccountId,
      walletId: data.walletId,
      apiKeyEncrypted: data.apiKeyEncrypted,
      status: data.status,
      generalStatus: data.generalStatus ?? null,
      commercialInfoStatus: data.commercialInfoStatus ?? null,
      documentStatus: data.documentStatus ?? null,
      bankAccountInfoStatus: data.bankAccountInfoStatus ?? null,
      onboardingUrl: data.onboardingUrl ?? null,
      rejectionReason: null,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(row);
    return row;
  }

  async update(
    id: string,
    data: UpdatePayoutAccountData,
  ): Promise<PayoutAccountRow | undefined> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return undefined;
    Object.assign(row, data, { updatedAt: new Date() });
    return row;
  }
}
