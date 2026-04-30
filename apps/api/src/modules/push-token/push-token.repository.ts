import type { InferSelectModel } from "drizzle-orm";
import type { pushTokens } from "@tatame/db";

export type PushTokenRow = InferSelectModel<typeof pushTokens>;

export interface IPushTokenRepository {
  upsert(data: {
    userId: string;
    token: string;
    platform: "ios" | "android";
    deviceId: string;
  }): Promise<PushTokenRow>;

  deleteByUserAndDevice(userId: string, deviceId: string): Promise<boolean>;

  findByUserId(userId: string): Promise<PushTokenRow[]>;

  deleteByToken(token: string): Promise<boolean>;
}
