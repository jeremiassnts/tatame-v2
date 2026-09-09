import { logs } from "@opentelemetry/api-logs";
import type { LogRecord, Logger, LoggerProvider } from "@opentelemetry/api-logs";
import { afterEach, describe, expect, it, vi } from "vitest";

/** Indexed access under `noUncheckedIndexedAccess`, with a useful failure. */
function at<T>(items: T[], index = 0): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`expected an item at index ${index}, got ${items.length} total`);
  }
  return item;
}


/** Captures what the logger hands to the OTel logs API. */
function captureOtel() {
  const emitted: LogRecord[] = [];
  const logger = { emit: (r: LogRecord) => emitted.push(r) } as unknown as Logger;
  logs.setGlobalLoggerProvider({ getLogger: () => logger } as unknown as LoggerProvider);
  return emitted;
}

/** Captures what the logger writes to stdout. */
function captureStdout() {
  const lines: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
  return lines;
}

/**
 * Config is read at module load, so every test that changes the environment
 * needs a fresh module instance.
 */
async function loadLogger(env: Record<string, string> = { LOG_LEVEL: "debug" }) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return (await import("./logger.js")).log;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  logs.disable();
});

describe("stdout", () => {
  it("writes one JSON object per line when not a TTY", async () => {
    const lines = captureStdout();
    const log = await loadLogger();
    log.info("hello", { userId: "u1" });

    expect(lines).toHaveLength(1);
    expect(at(lines).endsWith("\n")).toBe(true);
    const parsed = JSON.parse(at(lines)) as Record<string, unknown>;
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("hello");
    expect(parsed.userId).toBe("u1");
    expect(typeof parsed.time).toBe("string");
  });

  it("writes even when no global logger provider was ever registered", async () => {
    // The `pnpm api:dev` path with the stack down. Nothing must be lost.
    const lines = captureStdout();
    const log = await loadLogger();
    expect(() => log.warn("no provider here")).not.toThrow();
    expect(lines).toHaveLength(1);
  });
});

describe("OTel emission", () => {
  it("emits a record with body and severity", async () => {
    captureStdout();
    const emitted = captureOtel();
    const log = await loadLogger();
    log.info("hello");

    expect(emitted).toHaveLength(1);
    expect(at(emitted).body).toBe("hello");
    expect(at(emitted).severityText).toBe("INFO");
    expect(at(emitted).severityNumber).toBe(9);
  });

  it.each([
    ["debug", 5, "DEBUG"],
    ["info", 9, "INFO"],
    ["warn", 13, "WARN"],
    ["error", 17, "ERROR"],
  ] as const)("maps %s to severity %i", async (level, number, text) => {
    captureStdout();
    const emitted = captureOtel();
    const log = await loadLogger();
    log[level]("msg");

    expect(at(emitted).severityNumber).toBe(number);
    expect(at(emitted).severityText).toBe(text);
  });

  it("puts fields on attributes, not in the body", async () => {
    captureStdout();
    const emitted = captureOtel();
    const log = await loadLogger();
    log.info("checkin", { userId: "u1", classId: "c1" });

    expect(at(emitted).body).toBe("checkin");
    expect(at(emitted).attributes).toMatchObject({ userId: "u1", classId: "c1" });
  });
});

describe("errors", () => {
  it("expands `err` into exception attributes", async () => {
    captureStdout();
    const emitted = captureOtel();
    const log = await loadLogger();
    const err = new Error("boom");
    log.error("failed", { err });

    expect(at(emitted).attributes).toMatchObject({
      "exception.type": "Error",
      "exception.message": "boom",
    });
    expect(at(emitted).attributes?.["exception.stacktrace"]).toContain("Error: boom");
  });

  it("does not leave a raw `err` object on the attributes", async () => {
    captureStdout();
    const emitted = captureOtel();
    const log = await loadLogger();
    log.error("failed", { err: new Error("boom") });

    expect(at(emitted).attributes).not.toHaveProperty("err");
  });

  it("handles a thrown non-Error", async () => {
    captureStdout();
    const emitted = captureOtel();
    const log = await loadLogger();
    log.error("failed", { err: "just a string" });

    expect(at(emitted).attributes?.["exception.message"]).toBe("just a string");
  });
});

describe("redaction", () => {
  it("redacts sensitive field names", async () => {
    const lines = captureStdout();
    const emitted = captureOtel();
    const log = await loadLogger();
    log.info("login", { userId: "u1", password: "hunter2", apiKey: "abc" });

    expect(at(lines)).not.toContain("hunter2");
    expect(at(emitted).attributes).toMatchObject({
      userId: "u1",
      password: "[redacted]",
      apiKey: "[redacted]",
    });
  });
});

describe("levels", () => {
  it("drops records below the configured level", async () => {
    const lines = captureStdout();
    const emitted = captureOtel();
    const log = await loadLogger({ LOG_LEVEL: "warn" });

    log.debug("no");
    log.info("no");
    log.warn("yes");
    log.error("yes");

    expect(lines).toHaveLength(2);
    expect(emitted).toHaveLength(2);
  });

  it("is silent under NODE_ENV=test with no LOG_LEVEL", async () => {
    const lines = captureStdout();
    const emitted = captureOtel();
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("LOG_LEVEL", "");
    const { log } = await import("./logger.js");

    log.error("should not appear in vitest output");

    expect(lines).toHaveLength(0);
    expect(emitted).toHaveLength(0);
  });

  it("LOG_LEVEL un-silences it under NODE_ENV=test", async () => {
    const lines = captureStdout();
    const log = await loadLogger({ NODE_ENV: "test", LOG_LEVEL: "debug" });
    log.debug("now visible");
    expect(lines).toHaveLength(1);
  });

  it("defaults to info outside tests", async () => {
    const lines = captureStdout();
    const log = await loadLogger({ NODE_ENV: "development", LOG_LEVEL: "" });
    log.debug("no");
    log.info("yes");
    expect(lines).toHaveLength(1);
  });
});

describe("never fails the caller", () => {
  it("swallows a field that throws while being serialized", async () => {
    captureStdout();
    captureOtel();
    const log = await loadLogger();
    const hostile = {
      get boom() {
        throw new Error("getter exploded");
      },
    };

    expect(() => log.info("hostile", hostile)).not.toThrow();
  });

  it("swallows an emit that throws", async () => {
    captureStdout();
    const logger = {
      emit: () => {
        throw new Error("exporter died");
      },
    } as unknown as Logger;
    logs.setGlobalLoggerProvider({ getLogger: () => logger } as unknown as LoggerProvider);
    const log = await loadLogger();

    expect(() => log.info("still fine")).not.toThrow();
  });

  it("swallows a stdout write that throws", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => {
      throw new Error("EPIPE");
    });
    const log = await loadLogger();

    expect(() => log.info("still fine")).not.toThrow();
  });
});

describe("child", () => {
  it("binds fields onto every record", async () => {
    captureStdout();
    const emitted = captureOtel();
    const log = await loadLogger();
    const worker = log.child({ component: "email", jobId: "j1" });

    worker.info("job started");

    expect(at(emitted).attributes).toMatchObject({
      component: "email",
      jobId: "j1",
    });
  });

  it("lets a call-site field win over a bound one", async () => {
    captureStdout();
    const emitted = captureOtel();
    const log = await loadLogger();

    log.child({ jobId: "bound" }).info("x", { jobId: "call-site" });

    expect(at(emitted).attributes?.jobId).toBe("call-site");
  });

  it("does not mutate the parent", async () => {
    captureStdout();
    const emitted = captureOtel();
    const log = await loadLogger();

    log.child({ component: "email" });
    log.info("parent");

    expect(at(emitted).attributes).not.toHaveProperty("component");
  });
});
