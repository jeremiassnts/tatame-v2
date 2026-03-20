import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    environment: "node",
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
          pool: "forks",
          poolOptions: {
            forks: {
              isolate: true,
            },
          },
          environment: "node",
          globalSetup: ["./src/testing/global-setup.ts"],
        },
      },
    ],
  },
});
