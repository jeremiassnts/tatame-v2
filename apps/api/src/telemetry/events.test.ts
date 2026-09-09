import { logs } from "@opentelemetry/api-logs";
import type { LogRecord, Logger, LoggerProvider } from "@opentelemetry/api-logs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOG, emitEvent } from "./events.js";

/** Indexed access under `noUncheckedIndexedAccess`, with a useful failure. */
function at<T>(items: T[], index = 0): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`expected an item at index ${index}, got ${items.length} total`);
  }
  return item;
}


function captureOtel() {
  const emitted: LogRecord[] = [];
  const logger = { emit: (r: LogRecord) => emitted.push(r) } as unknown as Logger;
  logs.setGlobalLoggerProvider({ getLogger: () => logger } as unknown as LoggerProvider);
  return emitted;
}

/**
 * `logger.ts` reads `LOG_LEVEL` at module load, and vitest runs with
 * `NODE_ENV=test`, where the logger is silent by default. So the environment has
 * to be set *before* the module graph is loaded — hence the reset and the
 * dynamic import. Same pattern as `logger.test.ts`.
 */
async function setup() {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const emitted = captureOtel();
  vi.resetModules();
  vi.stubEnv("LOG_LEVEL", "debug");
  const { emitEvent: emit } = await import("./events.js");
  return { emitted, emitEvent: emit };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  logs.disable();
});

describe("the catalog itself", () => {
  it("derives every domain from the event name's prefix", () => {
    for (const [name, entry] of Object.entries(CATALOG)) {
      expect(name.startsWith(`${entry.domain}.`)).toBe(true);
    }
  });

  it("only ever declares reasons on non-success outcomes", () => {
    for (const [name, entry] of Object.entries(CATALOG)) {
      if ("reasons" in entry) {
        expect(entry.outcome, `${name} declares reasons`).not.toBe("success");
      }
    }
  });

  it("keeps every reason low cardinality and screaming snake case", () => {
    for (const entry of Object.values(CATALOG)) {
      if (!("reasons" in entry)) continue;
      for (const reason of entry.reasons) {
        expect(reason).toMatch(/^[A-Z][A-Z0-9_]*$/);
      }
    }
  });

  it("covers the eight P1 domains from the spec", () => {
    const domains = new Set(Object.values(CATALOG).map((e) => e.domain));
    expect([...domains].sort()).toEqual([
      "access",
      "checkin",
      "graduation",
      "manager_subscription",
      "membership",
      "payment",
      "request",
      "subscription",
    ]);
  });
});

describe("emitEvent", () => {
  it("writes the catalog's own fields onto the record", async () => {
    const { emitted, emitEvent } = await setup();
    emitEvent("checkin.created", { userId: "u1", academyId: "a1", classId: "c1" });

    expect(at(emitted).attributes).toMatchObject({
      "event.name": "checkin.created",
      "event.domain": "checkin",
      "event.outcome": "success",
    });
  });

  it("writes event.name to the native eventName field as well", async () => {
    // Loki drops the native field (see spec, "Found during implementation"), so
    // the attribute above is what queries use. This keeps the semconv-correct
    // home populated for any backend that does read it.
    const { emitted, emitEvent } = await setup();
    emitEvent("checkin.created", { userId: "u1" });
    expect(at(emitted).eventName).toBe("checkin.created");
  });

  it("maps identifiers onto their semconv attribute names", async () => {
    const { emitted, emitEvent } = await setup();
    emitEvent("checkin.created", {
      userId: "u1",
      actorRole: "student",
      academyId: "a1",
      classId: "c1",
      checkinId: "ck1",
    });

    expect(at(emitted).attributes).toMatchObject({
      "user.id": "u1",
      "app.actor.role": "student",
      "app.academy.id": "a1",
      "app.class.id": "c1",
      "app.checkin.id": "ck1",
    });
  });

  it("carries the reason on a rejection", async () => {
    const { emitted, emitEvent } = await setup();
    emitEvent("checkin.rejected", { userId: "u1", reason: "CLASS_FULL" });

    expect(at(emitted).attributes).toMatchObject({
      "event.outcome": "rejected",
      "event.reason": "CLASS_FULL",
    });
  });

  it("logs a rejection at warn and a success at info", async () => {
    const { emitted, emitEvent } = await setup();
    emitEvent("checkin.created", { userId: "u1" });
    emitEvent("checkin.rejected", { userId: "u1", reason: "CLASS_FULL" });

    expect(at(emitted).severityText).toBe("INFO");
    expect(at(emitted, 1).severityText).toBe("WARN");
  });

  it("logs a failure at error and expands the cause", async () => {
    const { emitted, emitEvent } = await setup();
    emitEvent("request.failed", { err: new Error("boom") });

    expect(at(emitted).severityText).toBe("ERROR");
    expect(at(emitted).attributes).toMatchObject({
      "exception.type": "Error",
      "exception.message": "boom",
    });
  });

  it("passes `extra` through under a prefix so it cannot collide", async () => {
    const { emitted, emitEvent } = await setup();
    emitEvent("payment.checkout_started", { userId: "u1", extra: { method: "pix" } });

    expect(at(emitted).attributes).toMatchObject({ "app.method": "pix" });
  });

  it("omits identifiers that were not supplied", async () => {
    const { emitted, emitEvent } = await setup();
    emitEvent("checkin.created", { userId: "u1" });

    expect(at(emitted).attributes).not.toHaveProperty("app.class.id");
    expect(at(emitted).attributes).not.toHaveProperty("app.academy.id");
  });

  it("never fails the caller", async () => {
    const { emitEvent } = await setup();
    const hostile = { get boom(): string { throw new Error("exploded"); } };
    expect(() =>
      emitEvent("checkin.created", { userId: "u1", extra: hostile }),
    ).not.toThrow();
  });
});

describe("personal data", () => {
  it("redacts anything that looks like a credential in `extra`", async () => {
    const { emitted, emitEvent } = await setup();
    emitEvent("checkin.created", {
      userId: "u1",
      extra: { password: "hunter2", apiKey: "abc", sessionToken: "xyz" },
    });

    const attrs = JSON.stringify(at(emitted).attributes);
    expect(attrs).not.toContain("hunter2");
    expect(attrs).not.toContain("abc");
    expect(attrs).not.toContain("xyz");
  });

  it("has no field on EventFields that carries personal data", async () => {
    // The guard is the closed `EventFields` type — there is no `email`, `name`,
    // `phone` or `document` key to pass. This asserts the shape stays closed by
    // checking the one escape hatch is the only open door.
    const { emitted, emitEvent } = await setup();
    emitEvent("membership.approved", { userId: "u1", membershipId: "m1" });

    for (const key of Object.keys(at(emitted).attributes ?? {})) {
      expect(key).not.toMatch(/email|phone|cpf|document|fullname/i);
    }
  });
});

describe("type-level contract", () => {
  it("rejects the four ways a call site can get the catalog wrong", () => {
    // These are the real assertions: `@ts-expect-error` fails the build when the
    // error it names stops occurring, so each line pins one rule of LOG-12.

    // @ts-expect-error — `reason` is required on an event that declares reasons
    emitEvent("checkin.rejected", { userId: "u1" });

    // @ts-expect-error — `reason` is forbidden on an event that declares none
    emitEvent("checkin.created", { userId: "u1", reason: "CLASS_FULL" });

    // @ts-expect-error — `PLAN_REQUIRED` belongs to `access`, not `checkin`
    emitEvent("checkin.rejected", { userId: "u1", reason: "PLAN_REQUIRED" });

    // @ts-expect-error — the event name is not in the catalog
    emitEvent("checkin.invented", { userId: "u1" });

    // @ts-expect-error — `EventFields` is closed; no arbitrary keys
    emitEvent("checkin.created", { userId: "u1", email: "a@b.com" });

    expect(true).toBe(true);
  });
});
