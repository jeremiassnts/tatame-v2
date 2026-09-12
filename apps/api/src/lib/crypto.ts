import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { loadEnv } from "@tatame/config";

/**
 * Symmetric encryption for the Asaas subaccount API keys at rest.
 *
 * Asaas returns a subaccount's key exactly once, at creation, and there is no
 * endpoint to read it back. It is also the credential that lets the API act as
 * that academy — listing its pending documents, uploading them, reading its
 * status. So it has to be stored, and storing it in plaintext would mean a
 * database dump is a set of live payment credentials for every academy.
 *
 * Nothing here is Asaas-specific; it is named for the column it protects.
 */

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
/** 96 bits is the IV size GCM is specified for; anything else costs security. */
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function getKey(): Buffer {
  const { PAYOUT_ACCOUNT_ENCRYPTION_KEY: hex } = loadEnv();
  if (!hex) {
    throw new Error(
      "PAYOUT_ACCOUNT_ENCRYPTION_KEY is not configured — payout account secrets cannot be read or written",
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Returns `v1.<iv>.<authTag>.<ciphertext>`, each part base64. The version
 * prefix is what makes a key rotation possible later without guessing at the
 * shape of rows written today.
 */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

/**
 * Throws on anything that is not an intact envelope this key can open. That is
 * deliberate: a payout account whose key cannot be decrypted must fail the
 * request loudly rather than be quietly skipped, because "skipped" looks
 * exactly like "this academy has no pending documents".
 */
export function decryptSecret(envelope: string): string {
  const parts = envelope.split(".");
  if (parts.length !== 4) {
    throw new Error("Malformed payout account secret: expected 4 parts");
  }
  const [version, ivB64, authTagB64, ciphertextB64] = parts as [
    string,
    string,
    string,
    string,
  ];
  if (version !== VERSION) {
    throw new Error(`Unsupported payout account secret version: ${version}`);
  }

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error("Malformed payout account secret: bad IV or auth tag");
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  // `final()` is what verifies the tag, so a tampered ciphertext throws here
  // rather than returning plausible garbage.
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
