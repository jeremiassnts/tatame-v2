import { describe, expect, it } from "vitest";
import { isSensitive, redact, serialize } from "./redact.js";

describe("isSensitive", () => {
  it.each([
    "password",
    "userPassword",
    "passwd",
    "passphrase",
    "clientSecret",
    "access_token",
    "authorization",
    "x-authorization-header",
    "cookie",
    "credential",
    "signature",
  ])("matches the long word %s anywhere in the key", (key) => {
    expect(isSensitive(key)).toBe(true);
  });

  it.each(["key", "apiKey", "api_key", "keys", "auth", "pin", "otp", "sig", "jwt", "salt", "hash"])(
    "matches the short word %s on a whole segment",
    (key) => {
      expect(isSensitive(key)).toBe(true);
    },
  );

  it.each(["monkey", "pinned", "hashtag", "signal", "author", "keyboard"])(
    "leaves %s alone — a short word must not match as a substring",
    (key) => {
      // This is the pair that broke once: dropping `key` from the list to protect
      // `monkey` silently stopped redacting `apiKey`.
      expect(isSensitive(key)).toBe(false);
    },
  );

  it("is case insensitive", () => {
    expect(isSensitive("PASSWORD")).toBe(true);
    expect(isSensitive("Api_Key")).toBe(true);
  });
});

describe("redact", () => {
  it("replaces sensitive values and keeps the rest", () => {
    expect(redact({ password: "hunter2", name: "Jeremias" })).toEqual({
      password: "[redacted]",
      name: "Jeremias",
    });
  });

  it("walks nested objects", () => {
    expect(redact({ user: { profile: { apiKey: "abc", city: "SP" } } })).toEqual({
      user: { profile: { apiKey: "[redacted]", city: "SP" } },
    });
  });

  it("walks arrays", () => {
    expect(redact([{ token: "a" }, { token: "b" }])).toEqual([
      { token: "[redacted]" },
      { token: "[redacted]" },
    ]);
  });

  it("passes primitives through untouched", () => {
    expect(redact("plain")).toBe("plain");
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
  });

  it("bottoms out at max depth instead of recursing forever", () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;
    expect(JSON.stringify(redact(circular))).toContain("[max depth]");
  });
});

describe("serialize", () => {
  it("returns a string body unchanged", () => {
    expect(serialize("Bad Request")).toBe("Bad Request");
  });

  it("serializes and redacts an object", () => {
    expect(serialize({ error: "boom", token: "abc" })).toBe(
      '{"error":"boom","token":"[redacted]"}',
    );
  });

  it("truncates past the default 2048-char cap", () => {
    const out = serialize({ error: "x".repeat(5000) });
    expect(out).toHaveLength(2048 + "…[truncated]".length);
    expect(out.endsWith("…[truncated]")).toBe(true);
  });

  it("honours a caller-supplied cap", () => {
    const out = serialize({ error: "x".repeat(500) }, 32);
    expect(out).toHaveLength(32 + "…[truncated]".length);
  });

  it("does not truncate a body under the cap", () => {
    expect(serialize({ error: "small" })).toBe('{"error":"small"}');
  });

  it("falls back to a marker for a value JSON cannot express", () => {
    expect(serialize({ size: 1n })).toBe("[unserializable]");
  });
});
