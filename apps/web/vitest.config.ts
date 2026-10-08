import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node, not jsdom. Every decision these pages make lives in a pure module
    // (`resolveInviteView`, `detectPlatform`) or in a route handler returning a
    // `Response`; the components forward a view model into markup, and
    // `react-dom/server` renders them to a string without a DOM.
    environment: "node",
    include: ["{app,lib,components}/**/*.test.{ts,tsx}"],
  },
  // Next compiles JSX with the automatic runtime; esbuild has to be told, or a
  // `.tsx` test fails with "React is not defined".
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
