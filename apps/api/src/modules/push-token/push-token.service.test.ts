import { describe, expect, it } from "vitest";
import { HttpError } from "../../lib/http-error.js";
import { InMemoryPushTokenRepository } from "./push-token.repository.in-memory.js";
import { PushTokenService } from "./push-token.service.js";

function setup() {
  const repo = new InMemoryPushTokenRepository();
  const service = new PushTokenService(repo);
  return { repo, service };
}

describe("PushTokenService", () => {
  describe("register", () => {
    it("creates a new push token", async () => {
      const { service } = setup();
      const row = await service.register({
        userId: "clerk_abc",
        token: "ExponentPushToken[xxx]",
        platform: "ios",
        deviceId: "device-1",
      });
      expect(row.userId).toBe("clerk_abc");
      expect(row.token).toBe("ExponentPushToken[xxx]");
      expect(row.platform).toBe("ios");
      expect(row.deviceId).toBe("device-1");
    });

    it("upserts when same user+device registers again", async () => {
      const { service } = setup();
      await service.register({
        userId: "clerk_abc",
        token: "ExponentPushToken[old]",
        platform: "ios",
        deviceId: "device-1",
      });
      const updated = await service.register({
        userId: "clerk_abc",
        token: "ExponentPushToken[new]",
        platform: "ios",
        deviceId: "device-1",
      });
      expect(updated.token).toBe("ExponentPushToken[new]");
      const tokens = await service.getTokensForUser("clerk_abc");
      expect(tokens).toHaveLength(1);
    });
  });

  describe("unregister", () => {
    it("deletes an existing token", async () => {
      const { service } = setup();
      await service.register({
        userId: "clerk_abc",
        token: "ExponentPushToken[xxx]",
        platform: "ios",
        deviceId: "device-1",
      });
      await service.unregister("clerk_abc", "device-1");
      const tokens = await service.getTokensForUser("clerk_abc");
      expect(tokens).toHaveLength(0);
    });

    it("throws 404 when token not found", async () => {
      const { service } = setup();
      await expect(
        service.unregister("clerk_abc", "nonexistent"),
      ).rejects.toThrow(HttpError);
    });
  });

  describe("removeStaleToken", () => {
    it("removes token by value", async () => {
      const { service } = setup();
      await service.register({
        userId: "clerk_abc",
        token: "ExponentPushToken[stale]",
        platform: "android",
        deviceId: "device-1",
      });
      await service.removeStaleToken("ExponentPushToken[stale]");
      const tokens = await service.getTokensForUser("clerk_abc");
      expect(tokens).toHaveLength(0);
    });
  });
});
