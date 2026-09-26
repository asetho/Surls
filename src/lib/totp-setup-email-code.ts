import { randomInt } from "node:crypto";
import { hashToken, randomToken, signValue, timingSafeEqual, verifySignedValue } from "./crypto";
import { isProduction } from "./env";

export const TOTP_SETUP_EMAIL_CODE_COOKIE = "surls_totp_setup_email_code";
const MAX_AGE_SECONDS = 10 * 60;

type TotpSetupEmailCode = {
  purpose: "totp-setup-email";
  userId: string;
  sessionId: string;
  currentEmail: string;
  codeHash: string;
  nonce: string;
  issuedAt: number;
};

export function totpSetupEmailCodeCookieOptions() {
  return { httpOnly: true, secure: isProduction(), sameSite: "lax" as const, path: "/admin/profile", maxAge: MAX_AGE_SECONDS };
}

export function createTotpSetupEmailCode(userId: string, sessionId: string, currentEmail: string) {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const proof: TotpSetupEmailCode = {
    purpose: "totp-setup-email", userId, sessionId, currentEmail,
    codeHash: hashToken(code), nonce: randomToken(), issuedAt: Date.now()
  };
  return { code, cookie: signValue(Buffer.from(JSON.stringify(proof)).toString("base64url")) };
}

export function decodeTotpSetupEmailCode(value: string | undefined): TotpSetupEmailCode | null {
  if (!value || value.length > 2048) return null;
  const encoded = verifySignedValue(value);
  if (!encoded) return null;
  try {
    const proof = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TotpSetupEmailCode;
    if (proof.purpose !== "totp-setup-email" ||
        typeof proof.userId !== "string" || !proof.userId ||
        typeof proof.sessionId !== "string" || !proof.sessionId ||
        typeof proof.currentEmail !== "string" || !proof.currentEmail ||
        typeof proof.codeHash !== "string" || !/^[a-f0-9]{64}$/.test(proof.codeHash) ||
        typeof proof.nonce !== "string" || proof.nonce.length < 30 ||
        !Number.isSafeInteger(proof.issuedAt) || proof.issuedAt > Date.now() + 30_000 ||
        Date.now() - proof.issuedAt > MAX_AGE_SECONDS * 1000) return null;
    return proof;
  } catch {
    return null;
  }
}

export function verifyTotpSetupEmailCode(proof: TotpSetupEmailCode, code: string) {
  return /^[0-9]{6}$/.test(code) && timingSafeEqual(proof.codeHash, hashToken(code));
}
