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
    include: ["{app,lib}/**/*.test.ts", "*.test.ts"],
  },
  resolve: {
    // Matches the `@/*` -> `./*` paths entry in `apps/mobile/tsconfig.json`,
    // which is what Metro resolves through babel-preset-expo.
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
