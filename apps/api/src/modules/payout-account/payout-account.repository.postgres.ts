import { eq } from "drizzle-orm";
import { academyPayoutAccounts, type Database } from "@tatame/db";
import type {
  CreatePayoutAccountData,
  IPayoutAccountRepository,
  PayoutAccountRow,
  UpdatePayoutAccountData,
} from "./payout-account.repository.js";

export class PostgresPayoutAccountRepository
  implements IPayoutAccountRepository
{
  constructor(private readonly db: Database) {}

  async findByAcademyId(
    academyId: string,
  ): Promise<PayoutAccountRow | undefined> {
    const [row] = await this.db
      .select()
      .from(academyPayoutAccounts)
      .where(eq(academyPayoutAccounts.academyId, academyId))
      .limit(1);
    return row;
  }

  async findByExternalAccountId(
    externalAccountId: string,
  ): Promise<PayoutAccountRow | undefined> {
    const [row] = await this.db
      .select()
      .from(academyPayoutAccounts)
      .where(eq(academyPayoutAccounts.externalAccountId, externalAccountId))
      .limit(1);
    return row;
  }

  async create(data: CreatePayoutAccountData): Promise<PayoutAccountRow> {
    const rows = await this.db
      .insert(academyPayoutAccounts)
      .values({
        academyId: data.academyId,
        externalAccountId: data.externalAccountId,
        walletId: data.walletId,
        apiKeyEncrypted: data.apiKeyEncrypted,
        status: data.status,
        generalStatus: data.generalStatus ?? null,
        commercialInfoStatus: data.commercialInfoStatus ?? null,
        documentStatus: data.documentStatus ?? null,
        bankAccountInfoStatus: data.bankAccountInfoStatus ?? null,
        onboardingUrl: data.onboardingUrl ?? null,
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("Failed to create payout account");
    return row;
  }

  async update(
    id: string,
    data: UpdatePayoutAccountData,
  ): Promise<PayoutAccountRow | undefined> {
    const rows = await this.db
      .update(academyPayoutAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(academyPayoutAccounts.id, id))
      .returning();
    return rows[0];
  }
}
