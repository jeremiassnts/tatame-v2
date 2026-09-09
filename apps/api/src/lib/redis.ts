import { createClient, type RedisClientType } from "redis";
import { loadEnv } from "@tatame/config";
import { log } from "../telemetry/logger.js";

let client: RedisClientType | undefined;

export class RedisUnavailableError extends Error {
  constructor() {
    super("Redis is unavailable; check-in is disabled (spec §7)");
    this.name = "RedisUnavailableError";
  }
}

/**
 * Returns a connected Redis client, or `null` when `REDIS_URL` is unset.
 * For check-in, use `requireRedisForCheckin()` instead.
 */
export async function getRedis(): Promise<RedisClientType | null> {
  const { REDIS_URL } = loadEnv();
  if (!REDIS_URL) return null;
  if (!client) {
    client = createClient({ url: REDIS_URL });
    client.on("error", (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("connection error", { component: "redis", err: msg });
    });
  }
  if (!client.isOpen) await client.connect();
  return client;
}

/** Check-in entrypoints must call this; throws when Redis cannot be used. */
export async function requireRedisForCheckin(): Promise<RedisClientType> {
  const { REDIS_URL } = loadEnv();
  if (!REDIS_URL) throw new RedisUnavailableError();
  const r = await getRedis();
  if (!r) throw new RedisUnavailableError();
  return r;
}
