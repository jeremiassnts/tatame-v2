import { randomUUID } from "node:crypto";
import type { IPushTokenRepository, PushTokenRow } from "./push-token.repository.js";

export class InMemoryPushTokenRepository implements IPushTokenRepository {
  constructor(private readonly rows: PushTokenRow[] = []) {}

  async upsert(data: {
    userId: string;
    token: string;
    platform: "ios" | "android";
    deviceId: string;
  }): Promise<PushTokenRow> {
    const existing = this.rows.find(
      (r) => r.userId === data.userId && r.deviceId === data.deviceId,
    );
    if (existing) {
      existing.token = data.token;
      existing.platform = data.platform;
      existing.updatedAt = new Date();
      return existing;
    }
    const now = new Date();
    const row: PushTokenRow = {
      id: randomUUID(),
      userId: data.userId,
      token: data.token,
      platform: data.platform,
      deviceId: data.deviceId,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(row);
    return row;
  }

  async deleteByUserAndDevice(userId: string, deviceId: string): Promise<boolean> {
    const idx = this.rows.findIndex(
      (r) => r.userId === userId && r.deviceId === deviceId,
    );
    if (idx === -1) return false;
    this.rows.splice(idx, 1);
    return true;
  }

  async findByUserId(userId: string): Promise<PushTokenRow[]> {
    return this.rows.filter((r) => r.userId === userId);
  }

  async deleteByToken(token: string): Promise<boolean> {
    const idx = this.rows.findIndex((r) => r.token === token);
    if (idx === -1) return false;
    this.rows.splice(idx, 1);
    return true;
  }
}
