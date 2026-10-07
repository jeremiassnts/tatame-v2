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

/**
 * The mirror of the checks above, and the one that was missing. A reason with
 * no call site reads as coverage and never fires; a reason that fires and no
 * alert rule matches is worse, because it looks handled and nobody is told.
 *
 * That is not hypothetical: the lost-payment rule matched only
 * `NO_PENDING_PIX|MISSING_REFERENCE`, so when TAT-104 moved student Pix onto
 * Asaas the reason a lost payment actually reports — `NO_PENDING_CHARGE` — had
 * no rule at all, on the one event that means money arrived and was not
 * recorded. Nothing failed, because nothing was watching the watchers.
 *
 * A text scan again, for the same reason as above: it checks the string the
 * rule file is actually provisioned from. It reads only the `expr:` lines,
 * never the whole file — a reason named in a comment or in an email
 * description is documentation, not a query, and matching those would let this
 * pass on prose while the rule stayed blind. (Checked: it does fail when the
 * reason is removed from the query but left in the description.)
 */
const RULES = join(
  SRC,
  "../../../infra/observability/grafana/provisioning/alerting/rules.yml",
);

/**
 * Reasons that are deliberately not alerted. Each one needs an argument, not
 * just an entry — adding a name here is how you say "this is normal traffic".
 */
const UNALERTED: Record<string, string> = {
  // Providers send dozens of event types the handlers have no reason to care
  // about. Counting them would make the rule fire forever.
  UNKNOWN_EVENT_TYPE: "ordinary provider chatter, filtered out of the rules",
};

describe("every money event a rule should catch is matched by one", () => {
  /** Only the LogQL/PromQL queries — see the note above. */
  const queries = readFileSync(RULES, "utf8")
    .split("\n")
    .filter((line) => line.trimStart().startsWith("expr:"))
    .join("\n");

  /** The events that mean money moved, or failed to. */
  const MONEY_EVENTS = [
    "payment.webhook_unhandled",
    "payment.charge_failed",
    "payment.reversed",
  ] as const;

  it.each(MONEY_EVENTS)("%s is queried by an alert rule", (name) => {
    expect(queries).toContain(`event_name="${name}"`);
  });

  const moneyReasons = MONEY_EVENTS.flatMap((name) => {
    const entry = CATALOG[name];
    return "reasons" in entry
      ? entry.reasons
          .filter((reason) => !(reason in UNALERTED))
          .map((reason) => [name, reason] as const)
      : [];
  });

  it.each(moneyReasons)("%s reason %s is matched by an alert query", (_name, reason) => {
    expect(queries).toContain(reason);
  });
});
