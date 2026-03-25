import { randomUUID } from "node:crypto";
import type { RedisClientType } from "redis";

/** Spec §7 — serializes check-ins per class session (calendar date). */
export function checkinLockKey(classId: string, date: string): string {
  return `checkin:lock:${classId}:${date}`;
}

export const CHECKIN_LOCK_TTL_SEC = 5;
const RETRY_MS = 500;

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export class CheckinLockBusyError extends Error {
  constructor() {
    super("Não foi possível adquirir o bloqueio de check-in; tente novamente");
    this.name = "CheckinLockBusyError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryAcquire(
  redis: RedisClientType,
  key: string,
  token: string,
): Promise<boolean> {
  const result = await redis.set(key, token, {
    NX: true,
    EX: CHECKIN_LOCK_TTL_SEC,
  });
  return result === "OK";
}

async function releaseLock(
  redis: RedisClientType,
  key: string,
  token: string,
): Promise<void> {
  try {
    await redis.eval(RELEASE_SCRIPT, {
      keys: [key],
      arguments: [token],
    });
  } catch {
    // TTL may have expired; safe to ignore
  }
}

/**
 * Spec §7: acquire `checkin:lock:{classId}:{date}` (5s TTL), retry once after 500ms,
 * run `fn`, then release only if we still hold the lock token.
 */
export async function withCheckinLock<T>(
  redis: RedisClientType,
  classId: string,
  date: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = checkinLockKey(classId, date);
  const token = randomUUID();
  let acquired = await tryAcquire(redis, key, token);
  if (!acquired) {
    await sleep(RETRY_MS);
    acquired = await tryAcquire(redis, key, token);
  }
  if (!acquired) throw new CheckinLockBusyError();
  try {
    return await fn();
  } finally {
    await releaseLock(redis, key, token);
  }
}
