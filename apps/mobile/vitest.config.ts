import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node, not jsdom and not jest-expo. Everything proven here is a pure
    // string function (`parseInviteLink`), a three-function module holding one
    // value (`pending-invite`), or the bytes of `app.json` — no component is
    // rendered, so a React Native renderer would only add setup that nothing
    // asserts against.
    environment: "node",
    // `app/` is deliberately absent: every `.ts` under it is scanned as a route
    // by expo-router, so a test file there stops the app from booting. The
    // route directory's own tests live at the package root — see
    // `native-intent.test.ts`, which also asserts the rule.
    include: ["lib/**/*.test.ts", "*.test.ts"],
  },
  resolve: {
    // Matches the `@/*` -> `./*` paths entry in `apps/mobile/tsconfig.json`,
    // which is what Metro resolves through babel-preset-expo.
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
