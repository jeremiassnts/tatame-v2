import { and, eq } from "drizzle-orm";
import { pushTokens, type Database } from "@tatame/db";
import type { IPushTokenRepository, PushTokenRow } from "./push-token.repository.js";

export class PostgresPushTokenRepository implements IPushTokenRepository {
  constructor(private readonly db: Database) {}

  async upsert(data: {
    userId: string;
    token: string;
    platform: "ios" | "android";
    deviceId: string;
  }): Promise<PushTokenRow> {
    const [row] = await this.db
      .insert(pushTokens)
      .values({
        userId: data.userId,
        token: data.token,
        platform: data.platform,
        deviceId: data.deviceId,
      })
      .onConflictDoUpdate({
        target: [pushTokens.userId, pushTokens.deviceId],
        set: {
          token: data.token,
          platform: data.platform,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error("Failed to upsert push token");
    return row;
  }

  async deleteByUserAndDevice(userId: string, deviceId: string): Promise<boolean> {
    const result = await this.db
      .delete(pushTokens)
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.deviceId, deviceId)))
      .returning({ id: pushTokens.id });
    return result.length > 0;
  }

  async findByUserId(userId: string): Promise<PushTokenRow[]> {
    return this.db.select().from(pushTokens).where(eq(pushTokens.userId, userId));
  }

  async deleteByToken(token: string): Promise<boolean> {
    const result = await this.db
      .delete(pushTokens)
      .where(eq(pushTokens.token, token))
      .returning({ id: pushTokens.id });
    return result.length > 0;
  }
}
