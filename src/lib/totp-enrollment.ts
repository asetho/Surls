import { decryptSecret, encryptSecret, hashToken, randomToken } from "./crypto";
import { isProduction } from "./env";

export const TOTP_ENROLLMENT_COOKIE = "surls_totp_enrollment";
export const TOTP_SETUP_COOKIE = "surls_totp_setup";
const MAX_AGE_SECONDS = 10 * 60;
const SETUP_MAX_AGE_SECONDS = 30 * 60;

type PendingSetup = {
  userId: string;
  sessionId: string;
  secretEncrypted: string;
  issuedAt: number;
};

type PendingEnrollment = {
  userId: string;
  sessionId: string;
  secretFingerprint: string;
  codes: string[];
  nonce: string;
  issuedAt: number;
};

export function totpSetupCookieOptions() {
  return { httpOnly: true, secure: isProduction(), sameSite: "lax" as const, path: "/admin/profile", maxAge: SETUP_MAX_AGE_SECONDS };
}

export function encodeTotpSetup(userId: string, sessionId: string, secretEncrypted: string) {
  return encryptSecret(JSON.stringify({ userId, sessionId, secretEncrypted, issuedAt: Date.now() } satisfies PendingSetup));
}

export function decodeTotpSetup(value: string | undefined): PendingSetup | null {
  if (!value || value.length > 2048) return null;
  try {
    const pending = JSON.parse(decryptSecret(value)) as PendingSetup;
    if (typeof pending.userId !== "string" || !pending.userId ||
        typeof pending.sessionId !== "string" || !pending.sessionId ||
        typeof pending.secretEncrypted !== "string" || !pending.secretEncrypted || pending.secretEncrypted.length > 1024 ||
        !Number.isSafeInteger(pending.issuedAt) || pending.issuedAt > Date.now() + 30_000 ||
        Date.now() - pending.issuedAt > SETUP_MAX_AGE_SECONDS * 1000) return null;
    return pending;
  } catch {
    return null;
  }
}

export function totpSetupSecretForSession(value: string | undefined, userId: string, sessionId: string) {
  const setup = decodeTotpSetup(value);
  return setup?.userId === userId && setup.sessionId === sessionId ? setup.secretEncrypted : null;
}

export function totpEnrollmentCookieOptions() {
  return { httpOnly: true, secure: isProduction(), sameSite: "lax" as const, path: "/admin/profile", maxAge: MAX_AGE_SECONDS };
}

export function createTotpEnrollment(userId: string, sessionId: string, secretEncrypted: string, codes: string[]) {
  const nonce = randomToken();
  const cookie = encryptSecret(JSON.stringify({
    userId, sessionId, secretFingerprint: hashToken(secretEncrypted), codes, nonce, issuedAt: Date.now()
  } satisfies PendingEnrollment));
  return { cookie, nonce };
}

export function decodeTotpEnrollment(value: string | undefined): PendingEnrollment | null {
  if (!value || value.length > 4096) return null;
  try {
    const pending = JSON.parse(decryptSecret(value)) as PendingEnrollment;
    if (typeof pending.userId !== "string" || !pending.userId || typeof pending.sessionId !== "string" || !pending.sessionId ||
        typeof pending.secretFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(pending.secretFingerprint) ||
        !Array.isArray(pending.codes) || pending.codes.length !== 10 ||
        pending.codes.some((code) => typeof code !== "string" || !/^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(code)) ||
        typeof pending.nonce !== "string" || pending.nonce.length < 30 ||
        !Number.isSafeInteger(pending.issuedAt) || pending.issuedAt > Date.now() + 30_000 ||
        Date.now() - pending.issuedAt > MAX_AGE_SECONDS * 1000) return null;
    return pending;
  } catch {
    return null;
  }
}
