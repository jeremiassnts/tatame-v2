import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  /** Required for check-in (spec §7); optional for other routes / local dev */
  REDIS_URL: z.string().url().optional(),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_PUBLIC_URL: z.string().url().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  /** Comma-separated origins for session JWT `azp` validation (e.g. Expo app, Next.js URL) */
  CLERK_AUTHORIZED_PARTIES: z.string().optional(),
  /** Minimum mobile app version required (semver, e.g. "1.0.0"). Clients below this are force-updated. */
  MIN_MOBILE_VERSION: z.string().default("1.0.0"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /** Stripe Price ID for the manager Pro subscription */
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  /** Base URL for the manager web portal (e.g., https://tatame.app/conta) */
  MANAGER_PORTAL_URL: z.string().url().optional(),
  ABACATEPAY_API_KEY: z.string().optional(),
  /** Asaas root account API key — creates subaccounts and owns every charge. */
  ASAAS_API_KEY: z.string().optional(),
  /** `https://api-sandbox.asaas.com` or `https://api.asaas.com` (no trailing `/v3`). */
  ASAAS_BASE_URL: z.string().url().optional(),
  /**
   * Expected value of the `asaas-access-token` header on incoming webhooks.
   * Asaas requires a webhook `authToken` of 32 to 255 characters and rejects
   * the webhook registration otherwise, so a short value fails at subaccount
   * creation rather than here.
   */
  ASAAS_WEBHOOK_TOKEN: z.string().min(32).max(255).optional(),
  /**
   * AES-256-GCM key for the stored Asaas subaccount API keys, as 64 hex chars
   * (32 bytes). Asaas returns a subaccount key exactly once, so losing this
   * value means no academy can finish onboarding from the app.
   */
  PAYOUT_ACCOUNT_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "PAYOUT_ACCOUNT_ENCRYPTION_KEY must be 64 hex characters")
    .optional(),
  /**
   * Whether plan creation and new enrolments require an approved receiving
   * account. Defaults to `false` because the onboarding UI ships only in the
   * mobile app: turning this on before that version reaches the stores leaves
   * managers with no way to satisfy the requirement. Turn it on once the
   * release carrying the onboarding flow has been adopted.
   */
  PAYOUT_ACCOUNT_REQUIRED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  RESEND_API_KEY: z.string().optional(),
  MANAGER_EMAIL: z.string().optional(),
  MANAGER_CLERK_ID: z.string().optional(),
  BULL_BOARD_USER: z.string().optional(),
  BULL_BOARD_PASS: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  ADMIN_JWT_SECRET: z.string().optional(),
  /** Comma-separated allowed CORS origins (e.g. "https://app.tatame.com,https://admin.tatame.com") */
  CORS_ORIGINS: z.string().optional(),
  /**
   * OTLP/gRPC endpoint of the OpenTelemetry Collector. When unset, the API skips
   * SDK initialisation entirely — observability is strictly opt-in.
   * Host: http://localhost:4317 — container: http://otel-collector:4317
   */
  OTEL_COLLECTOR_URL: z.string().url().optional(),
  /**
   * How often metrics are pushed to the Collector, in ms (default 10000).
   * Declared here for documentation; `instrumentation.ts` owns the default because
   * it runs before this schema is validated.
   */
  OTEL_METRIC_EXPORT_INTERVAL: z.coerce.number().int().positive().optional(),
  /** `service.name` resource attribute — becomes the `service_name` label in Prometheus. */
  OTEL_SERVICE_NAME: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(overrides?: Record<string, string | undefined>): Env {
  const source = { ...process.env, ...overrides };
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment: ${JSON.stringify(msg)}`);
  }
  return parsed.data;
}
