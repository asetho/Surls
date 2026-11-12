import { hashToken, signValue, timingSafeEqual, verifySignedValue } from "./crypto";
import type { SmtpTransportConfig } from "./smtp-settings";

const CHECK_LIFETIME_MS = 5 * 60 * 1000;

function fingerprint(config: SmtpTransportConfig) {
  return hashToken(JSON.stringify([
    config.host, config.port, config.from, config.fromName, config.username, config.password
  ]));
}

export function createSmtpCheckProof(adminId: string, config: SmtpTransportConfig, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ adminId, fingerprint: fingerprint(config), issuedAt: now })).toString("base64url");
  return { proof: signValue(payload), expiresAt: now + CHECK_LIFETIME_MS };
}

export function verifySmtpCheckProof(value: unknown, adminId: string, config: SmtpTransportConfig, now = Date.now()) {
  if (typeof value !== "string" || value.length > 512) return false;
  const encoded = verifySignedValue(value);
  if (!encoded) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return payload.adminId === adminId && typeof payload.issuedAt === "number" &&
      payload.issuedAt <= now && now - payload.issuedAt < CHECK_LIFETIME_MS &&
      typeof payload.fingerprint === "string" && timingSafeEqual(payload.fingerprint, fingerprint(config));
  } catch {
    return false;
  }
}
