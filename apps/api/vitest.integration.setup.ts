/**
 * Integration project only (after vitest.setup.ts).
 * Clerk must appear configured so createApp mounts clerkMiddleware and mocks can run;
 * unit/smoke tests expect CLERK_SECRET_KEY unset — see api.smoke.test.ts.
 */
process.env.CLERK_SECRET_KEY ??= "test_clerk_key";
process.env.CLERK_WEBHOOK_SIGNING_SECRET ??= "test_webhook_secret";
