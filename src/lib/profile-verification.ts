import { hashToken, randomToken, signValue, verifySignedValue } from "./crypto";
import { isProduction } from "./env";

export const PROFILE_VERIFICATION_COOKIE = "surls_profile_verification_v2";
const MAX_AGE_SECONDS = 5 * 60;
export type ProfileVerificationAction = "email-change" | "passkey-add" | "passkey-remove";

type ProfileVerification = {
  userId: string;
  sessionId: string;
  nonce: string;
  action: ProfileVerificationAction;
  pendingEmail?: string;
  resourceId?: string;
  mfaVerified: boolean;
  issuedAt: number;
};

export function profileVerificationCookieOptions() {
  return { httpOnly: true, secure: isProduction(), sameSite: "lax" as const, path: "/", maxAge: MAX_AGE_SECONDS };
}

export function encodeProfileVerification(userId: string, sessionId: string, pendingEmail?: string,
  action: ProfileVerificationAction = "email-change", resourceId?: string, mfaVerified = false) {
  const payload: ProfileVerification = { userId, sessionId, nonce: randomToken(), issuedAt: Date.now(), action, pendingEmail, resourceId, mfaVerified };
  return signValue(Buffer.from(JSON.stringify(payload)).toString("base64url"));
}

export function decodeProfileVerification(value: string | undefined): ProfileVerification | null {
  const encoded = value && verifySignedValue(value);
  if (!encoded) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ProfileVerification;
    if (typeof payload.userId !== "string" || !payload.userId || typeof payload.sessionId !== "string" || !payload.sessionId ||
        typeof payload.nonce !== "string" || payload.nonce.length < 30 ||
        !["email-change", "passkey-add", "passkey-remove"].includes(payload.action) ||
        typeof payload.mfaVerified !== "boolean" ||
        (payload.pendingEmail !== undefined && (typeof payload.pendingEmail !== "string" || payload.pendingEmail.length > 320)) ||
        (payload.resourceId !== undefined && (typeof payload.resourceId !== "string" || !payload.resourceId || payload.resourceId.length > 128)) ||
        (payload.action === "email-change" && (!payload.pendingEmail || payload.resourceId !== undefined)) ||
        (payload.action === "passkey-add" && (payload.pendingEmail !== undefined || payload.resourceId !== undefined)) ||
        (payload.action === "passkey-remove" && (payload.pendingEmail !== undefined || !payload.resourceId)) ||
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
