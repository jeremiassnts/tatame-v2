import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATALOG } from "./events.js";

/**
 * A catalog entry with no call site is worse than a missing one: it reads as
 * coverage on the dashboard and in the docs, and nothing ever fires it. This
 * scans the API source for every event name and reason and fails when one is
 * declared but never used.
 *
 * It is a text scan on purpose. The alternative — asserting emission from each
 * service's own unit test — would need `vi.resetModules` and environment
 * stubbing in eight test files, to check a string that this checks directly.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      sourceFiles(path, found);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      found.push(path);
    }
  }
  return found;
}

/** Everything under `src`, minus the catalog itself — declaring is not using. */
const callSites = sourceFiles(SRC)
  .filter((path) => !path.endsWith(join("telemetry", "events.ts")))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

describe("every catalog entry has a call site", () => {
  it.each(Object.keys(CATALOG))("%s is emitted somewhere", (name) => {
    expect(callSites).toContain(`"${name}"`);
  });

  const reasons = Object.entries(CATALOG).flatMap(([name, entry]) =>
    "reasons" in entry ? entry.reasons.map((reason) => [name, reason] as const) : [],
  );

  it.each(reasons)("%s can be rejected with %s", (_name, reason) => {
    expect(callSites).toContain(`"${reason}"`);
  });
});
