import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**", "eslint.config.js"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    // otel-esm-hook.mjs is plain ESM JavaScript loaded by `node --import`, so it is
    // outside the TS project and type-aware rules have no type information to use.
    ...tseslint.configs.disableTypeChecked,
    files: ["**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.ts"],
    rules: {
      // Express passes async route handlers where the framework ignores the returned Promise.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { arguments: false, attributes: false } },
      ],
      // In-memory repos keep `async` to match `I*Repository` without awaiting.
      "@typescript-eslint/require-await": "off",
      // Standard pattern for `declare global` / Express `Request` augmentation.
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // Everything goes through `src/telemetry/logger.ts`, so it reaches Loki
      // with the active span's trace id attached. A `console.log` is invisible
      // the moment the process is not a terminal you are watching.
      "no-console": "error",
    },
  },
  {
    // `instrumentation.ts` runs before Express is loaded, and importing the
    // logger would pull `@opentelemetry/api-logs` into that window — the exact
    // load-order hazard the whole telemetry module is arranged to avoid. It also
    // has no logger to use yet: it is what registers the provider.
    files: ["src/instrumentation.ts"],
    rules: { "no-console": "off" },
  },
  {
    // These are CLIs. Their output is the product, not a diagnostic, and it
    // should not depend on `LOG_LEVEL` to print what it did.
    files: ["src/seed.ts", "src/send-daily-summary.ts"],
    rules: { "no-console": "off" },
  },
  {
    // Tests build partial mocks and cast them to the collaborator interfaces they
    // stand in for; requiring full structural types here would make the mocks
    // noisier than the assertions they support.
    files: ["**/*.test.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
    },
  },
);
