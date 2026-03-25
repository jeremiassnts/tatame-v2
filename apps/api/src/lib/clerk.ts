import { createClerkClient } from "@clerk/backend";
import { loadEnv } from "@tatame/config";

let instance: ReturnType<typeof createClerkClient> | null = null;

export function getClerkClient() {
  if (!instance) {
    const env = loadEnv();
    if (!env.CLERK_SECRET_KEY) {
      throw new Error("CLERK_SECRET_KEY is required for Clerk backend client");
    }
    instance = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
  }
  return instance;
}
