import crypto from "node:crypto";
import { env } from "./env";

const HASH_ALGORITHM = "sha256";

function key() {
  return crypto.createHash("sha256").update(env.AUTH_SECRET).digest();
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string) {
  return crypto.createHmac(HASH_ALGORITHM, env.AUTH_SECRET).update(token).digest("hex");
}

export function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(value: string) {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) {
    throw new Error("Invalid encrypted secret payload.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

export function signValue(value: string) {
  return `${value}.${hashToken(value)}`;
}

export function verifySignedValue(signedValue: string) {
  const index = signedValue.lastIndexOf(".");
  if (index === -1) return null;
  const value = signedValue.slice(0, index);
  const signature = signedValue.slice(index + 1);
  return timingSafeEqual(hashToken(value), signature) ? value : null;
}

export function hashPrivacyValue(value: string | null | undefined) {
  if (!value) return null;
  return crypto.createHmac(HASH_ALGORITHM, env.AUTH_SECRET).update(value).digest("hex");
}
