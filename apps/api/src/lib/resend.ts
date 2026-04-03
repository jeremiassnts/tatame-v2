import { Resend } from "resend";
import { loadEnv } from "@tatame/config";

let resendInstance: Resend | null = null;

export function getResend(): Resend | null {
  const env = loadEnv();
  if (!env.RESEND_API_KEY) return null;
  if (!resendInstance) {
    resendInstance = new Resend(env.RESEND_API_KEY);
  }
  return resendInstance;
}
