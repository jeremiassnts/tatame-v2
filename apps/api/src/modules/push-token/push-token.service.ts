import { HttpError } from "../../lib/http-error.js";
import type { IPushTokenRepository } from "./push-token.repository.js";

export class PushTokenService {
  constructor(private readonly repo: IPushTokenRepository) {}

  async register(data: {
    userId: string;
    token: string;
    platform: "ios" | "android";
    deviceId: string;
  }) {
    return this.repo.upsert(data);
  }

  async unregister(userId: string, deviceId: string) {
    const deleted = await this.repo.deleteByUserAndDevice(userId, deviceId);
    if (!deleted) {
      throw new HttpError(404, "Push token not found");
    }
  }

  async getTokensForUser(userId: string) {
    return this.repo.findByUserId(userId);
  }

  async removeStaleToken(token: string) {
    await this.repo.deleteByToken(token);
  }
}
