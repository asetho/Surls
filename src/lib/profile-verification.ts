import { hashToken, randomToken, signValue, verifySignedValue } from "./crypto";
import { isProduction } from "./env";

export const PROFILE_VERIFICATION_COOKIE = "surls_profile_verification";
const MAX_AGE_SECONDS = 5 * 60;

type ProfileVerification = {
  userId: string;
  sessionId: string;
  nonce: string;
  pendingEmail?: string;
  issuedAt: number;
};

export function profileVerificationCookieOptions() {
  return { httpOnly: true, secure: isProduction(), sameSite: "lax" as const, path: "/admin/profile", maxAge: MAX_AGE_SECONDS };
}

export function encodeProfileVerification(userId: string, sessionId: string, pendingEmail?: string) {
  const payload: ProfileVerification = { userId, sessionId, nonce: randomToken(), issuedAt: Date.now(), pendingEmail };
  return signValue(Buffer.from(JSON.stringify(payload)).toString("base64url"));
}

export function decodeProfileVerification(value: string | undefined): ProfileVerification | null {
  const encoded = value && verifySignedValue(value);
  if (!encoded) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ProfileVerification;
    if (typeof payload.userId !== "string" || !payload.userId || typeof payload.sessionId !== "string" || !payload.sessionId ||
        typeof payload.nonce !== "string" || payload.nonce.length < 30 ||
        (payload.pendingEmail !== undefined && (typeof payload.pendingEmail !== "string" || payload.pendingEmail.length > 320)) ||
        !Number.isSafeInteger(payload.issuedAt) ||
        payload.issuedAt > Date.now() + 30_000 || Date.now() - payload.issuedAt > MAX_AGE_SECONDS * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function profileVerificationUseKey(nonce: string) {
  return `profile:verification:${hashToken(nonce)}`;
}
