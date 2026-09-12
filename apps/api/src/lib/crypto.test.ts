import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto.js";

const KEY = randomBytes(32).toString("hex");
const OTHER_KEY = randomBytes(32).toString("hex");

describe("payout account secret encryption", () => {
  let previous: string | undefined;

  beforeEach(() => {
    previous = process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY;
    process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY = KEY;
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY;
    else process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY = previous;
  });

  it("round-trips a secret", () => {
    const secret = "$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZm";
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("round-trips unicode and empty-adjacent values", () => {
    for (const secret of ["a", "ção — ✅", "x".repeat(4096)]) {
      expect(decryptSecret(encryptSecret(secret))).toBe(secret);
    }
  });

  it("produces a different ciphertext every time for the same input", () => {
    const secret = "same-secret";
    const a = encryptSecret(secret);
    const b = encryptSecret(secret);
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("never leaks the plaintext into the stored value", () => {
    const secret = "super-secret-token";
    expect(encryptSecret(secret)).not.toContain(secret);
  });

  it("stores a versioned, parseable envelope", () => {
    const parts = encryptSecret("whatever").split(".");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
  });

  it("refuses to encrypt when the key is not configured", () => {
    delete process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow(
      /PAYOUT_ACCOUNT_ENCRYPTION_KEY/,
    );
  });

  it("refuses to decrypt when the key is not configured", () => {
    const stored = encryptSecret("x");
    delete process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY;
    expect(() => decryptSecret(stored)).toThrow(
      /PAYOUT_ACCOUNT_ENCRYPTION_KEY/,
    );
  });

  it("fails loudly when decrypted with a different key", () => {
    const stored = encryptSecret("x");
    process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY = OTHER_KEY;
    expect(() => decryptSecret(stored)).toThrow();
  });

  it("fails loudly when the ciphertext was tampered with", () => {
    const [version, iv, tag, payload] = encryptSecret("x").split(".");
    const flipped = Buffer.from(payload!, "base64");
    flipped[0] = flipped[0]! ^ 0xff;
    const tampered = [version, iv, tag, flipped.toString("base64")].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("fails loudly when the auth tag was tampered with", () => {
    const [version, iv, tag, payload] = encryptSecret("x").split(".");
    const flipped = Buffer.from(tag!, "base64");
    flipped[0] = flipped[0]! ^ 0xff;
    const tampered = [version, iv, flipped.toString("base64"), payload].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("rejects a malformed envelope rather than returning garbage", () => {
    for (const bad of ["", "not-encrypted", "v1.only.three", "v2.a.b.c"]) {
      expect(() => decryptSecret(bad)).toThrow();
    }
  });

  it("rejects a key that is not 32 bytes of hex", () => {
    process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY = "abcd";
    expect(() => encryptSecret("x")).toThrow(/64 hex/);
  });
});
