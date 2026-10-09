import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-error";

/**
 * `lib/api.ts` imports `@clerk/clerk-expo` for `useApi`, which imports
 * `react-native`, which cannot load in `environment: "node"`. That import is
 * the whole reason door 6 moved `ApiError` out of that file — and doubling the
 * one hook is what lets this test load `lib/api.ts` anyway and prove the
 * re-export behaviourally rather than by reading its bytes.
 */
vi.mock("@clerk/clerk-expo", () => ({
  useAuth: () => ({ getToken: async () => null }),
}));

describe("door 6 - ApiError's two import paths", () => {
  it("is the same class through lib/api as through lib/api-error", async () => {
    // Identity, not shape. Every `instanceof ApiError` in `apps/mobile` is one
    // of these two paths, and two distinct classes would make every one of them
    // answer `false` for an error raised through the other.
    const api = await import("@/lib/api");

    expect(api.ApiError).toBe(ApiError);
    expect(new ApiError(409, "x") instanceof api.ApiError).toBe(true);
    expect(new api.ApiError(409, "x") instanceof ApiError).toBe(true);
  });

  it("keeps every existing importer compiling", async () => {
    // Ten non-test files import `ApiError` from `@/lib/api`, and `apps/mobile`
    // has neither a real `lint` nor a real `typecheck` — both scripts are
    // `echo` stubs — so deleting the re-export line breaks all ten with the
    // whole repository gate still green. This is the only thing that notices.
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");

    const root = new URL("../", import.meta.url).pathname;
    const importers: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry.startsWith(".")) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry) || entry.includes(".test.")) continue;
        const source = readFileSync(full, "utf8");
        if (/import\s+\{[^}]*\bApiError\b[^}]*\}\s+from\s+["']@\/lib\/api["']/.test(source)) {
          importers.push(full.slice(root.length));
        }
      }
    };

    for (const dir of ["app", "components", "constants", "lib", "scripts"]) {
      walk(join(root, dir));
    }

    expect(importers.length).toBeGreaterThanOrEqual(10);

    const api = readFileSync(join(root, "lib/api.ts"), "utf8");
    expect(api).toContain('export { ApiError } from "@/lib/api-error";');
  });
});
