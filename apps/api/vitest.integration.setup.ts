/**
 * Integration project only (after vitest.setup.ts).
 * Clerk must appear configured so createApp mounts clerkMiddleware and mocks can run;
 * unit/smoke tests expect CLERK_SECRET_KEY unset — see api.smoke.test.ts.
 */
process.env.CLERK_SECRET_KEY ??= "test_clerk_key";

/**
 * The receiving-account requirement ships off, because the onboarding flow it
 * depends on lives in a mobile release that cannot land with the API deploy.
 * The integration suite covers the feature, not the rollout switch, so it runs
 * with the rule enforced — `subscription.routes.ts` reads the flag once at
 * module load and the integration project shares one module registry, so this
 * has to be set before any test file imports the app. Both states of the
 * switch are covered directly in subscription.payout-gate.test.ts.
 */
process.env.PAYOUT_ACCOUNT_REQUIRED ??= "true";
