import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.repository.postgres.ts",
        "src/**/*.repository.ts",
        "src/**/*.routes.ts",
        "src/**/stripe-webhook.handler.ts",
        "src/**/abacatepay-webhook.handler.ts",
        "src/**/email.worker.ts",
        "src/**/email.queue.ts",
        "src/**/upload.config.ts",
        "src/**/upload.service.ts",
        "src/server.ts",
        "src/seed.ts",
        "src/migrate.ts",
        "src/env-bootstrap.ts",
        "src/router.ts",
        "src/lib/clerk.ts",
        "src/lib/db.ts",
        "src/lib/lock.ts",
        "src/lib/redis.ts",
        "src/lib/repo-factory.ts",
        "src/lib/resend.ts",
        "src/lib/stripe.ts",
        "src/testing/**",
        "vitest.integration.setup.ts",
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.integration.test.ts"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["src/**/*.integration.test.ts"],
          setupFiles: ["./vitest.setup.ts", "./vitest.integration.setup.ts"],
          pool: "threads",
          poolOptions: {
            threads: {
              singleThread: true,
            },
          },
          retry: 2,
          environment: "node",
          globalSetup: ["./src/testing/global-setup.ts"],
        },
      },
    ],
  },
});
