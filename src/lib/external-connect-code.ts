import { randomInt } from "node:crypto";
import { hashToken, randomToken, signValue, timingSafeEqual, verifySignedValue } from "./crypto";
import { isProduction } from "./env";

export const EXTERNAL_CONNECT_CODE_COOKIE = "surls_external_connect_code";
const MAX_AGE_SECONDS = 10 * 60;

type ConnectCode = {
  userId: string;
  sessionId: string;
  currentEmail: string;
  targetProvider: string;
  codeHash: string;
  nonce: string;
  issuedAt: number;
};

export function externalConnectCodeCookieOptions() {
  return { httpOnly: true, secure: isProduction(), sameSite: "lax" as const, path: "/api/auth/external", maxAge: MAX_AGE_SECONDS };
}

export function createExternalConnectCode(userId: string, sessionId: string, currentEmail: string, targetProvider: string) {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const payload: ConnectCode = { userId, sessionId, currentEmail, targetProvider, codeHash: hashToken(code), nonce: randomToken(), issuedAt: Date.now() };
  return { code, cookie: signValue(Buffer.from(JSON.stringify(payload)).toString("base64url")) };
}

export function decodeExternalConnectCode(value: string | undefined): ConnectCode | null {
  if (!value || value.length > 2048) return null;
  const encoded = verifySignedValue(value);
  if (!encoded) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ConnectCode;
    if (typeof payload.userId !== "string" || !payload.userId || typeof payload.sessionId !== "string" || !payload.sessionId ||
        typeof payload.currentEmail !== "string" || !payload.currentEmail ||
        typeof payload.targetProvider !== "string" || !payload.targetProvider ||
        typeof payload.codeHash !== "string" || !/^[a-f0-9]{64}$/.test(payload.codeHash) ||
        typeof payload.nonce !== "string" || payload.nonce.length < 30 ||
        !Number.isSafeInteger(payload.issuedAt) || payload.issuedAt > Date.now() + 30_000 ||
        Date.now() - payload.issuedAt > MAX_AGE_SECONDS * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifyExternalConnectCode(proof: ConnectCode, code: string) {
  return /^[0-9]{6}$/.test(code) && timingSafeEqual(proof.codeHash, hashToken(code));
}
