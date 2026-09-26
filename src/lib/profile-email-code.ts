import { randomInt } from "node:crypto";
import { hashToken, randomToken, signValue, timingSafeEqual, verifySignedValue } from "./crypto";
import { isProduction } from "./env";

export const PROFILE_EMAIL_CODE_COOKIE = "surls_profile_email_code";
const MAX_AGE_SECONDS = 10 * 60;

type EmailCodeProof = {
  userId: string;
  sessionId: string;
  currentEmail: string;
  pendingEmail: string;
  codeHash: string;
  nonce: string;
  issuedAt: number;
};

export function profileEmailCodeCookieOptions() {
  return { httpOnly: true, secure: isProduction(), sameSite: "lax" as const, path: "/admin/profile", maxAge: MAX_AGE_SECONDS };
}

export function createProfileEmailCode(userId: string, sessionId: string, currentEmail: string, pendingEmail: string) {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const payload: EmailCodeProof = {
    userId, sessionId, currentEmail, pendingEmail, codeHash: hashToken(code), nonce: randomToken(), issuedAt: Date.now()
  };
  return { code, cookie: signValue(Buffer.from(JSON.stringify(payload)).toString("base64url")) };
}

export function decodeProfileEmailCode(value: string | undefined): EmailCodeProof | null {
  if (!value || value.length > 2048) return null;
  const encoded = verifySignedValue(value);
  if (!encoded) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as EmailCodeProof;
    if (typeof payload.userId !== "string" || !payload.userId || typeof payload.sessionId !== "string" || !payload.sessionId ||
        typeof payload.currentEmail !== "string" || !payload.currentEmail ||
        typeof payload.pendingEmail !== "string" || !payload.pendingEmail ||
        typeof payload.codeHash !== "string" || !/^[a-f0-9]{64}$/.test(payload.codeHash) ||
        typeof payload.nonce !== "string" || payload.nonce.length < 30 ||
        !Number.isSafeInteger(payload.issuedAt) || payload.issuedAt > Date.now() + 30_000 ||
        Date.now() - payload.issuedAt > MAX_AGE_SECONDS * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifyProfileEmailCode(proof: EmailCodeProof, code: string) {
  return /^[0-9]{6}$/.test(code) && timingSafeEqual(proof.codeHash, hashToken(code));
}
