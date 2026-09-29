import eslint from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// `eslint-config-next` is deliberately not used: it pins `eslint@^7 || ^8 || ^9`
// and this workspace is on 10, which `apps/api` already sets. The two pieces of
// it that earn their keep — the Next rules and the hooks rules — are plain
// plugins with no eslint peer of their own, so they compose here instead.
export default tseslint.config(
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mjs}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  reactHooks.configs.flat["recommended-latest"],
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // Warnings, not errors, and deliberately so. These two are the
      // React-Compiler-era additions in eslint-plugin-react-hooks 7; the four
      // places they fire are all pre-existing `apps/web` components that
      // predate any lint config here. Clearing them means refactoring
      // components that have no tests, which is a pass of its own and has
      // nothing to do with whatever slice is being linted. Demoting keeps the
      // signal visible without making an unrelated gate red.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
    },
  },
);
