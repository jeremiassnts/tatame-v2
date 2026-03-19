import type { Env } from "./env.js";

export function clerkAuthorizedParties(env: Env): string[] | undefined {
  const raw = env.CLERK_AUTHORIZED_PARTIES;
  if (!raw?.trim()) return undefined;
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : undefined;
}

export function clerkWebhookSigningSecret(env: Env): string | undefined {
  return env.CLERK_WEBHOOK_SIGNING_SECRET ?? env.CLERK_WEBHOOK_SECRET;
}
