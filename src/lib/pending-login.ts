import { signValue, verifySignedValue } from "./crypto";
import { isProduction } from "./env";
import { safeRedirectPath } from "./redirect-path";

export const PENDING_LOGIN_COOKIE = "surls_pending_login";
export const PENDING_LOGIN_MAX_AGE_SECONDS = 5 * 60;

type PendingLoginPayload = {
  email: string;
  issuedAt: number;
  nextPath: string;
  purpose: "login_2fa";
  userId: string;
};

export function pendingLoginCookieOptions() {
  return {
    httpOnly: true,
    maxAge: PENDING_LOGIN_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: isProduction()
  };
}

export function expiredPendingLoginCookieOptions() {
  return {
    httpOnly: true,
    expires: new Date(0),
    maxAge: 0,
    path: "/",
    sameSite: "lax" as const,
    secure: isProduction()
  };
}

export function encodePendingLogin(payload: Omit<PendingLoginPayload, "issuedAt" | "purpose" | "nextPath"> & { nextPath?: unknown }) {
  const encoded = Buffer.from(
    JSON.stringify({
      ...payload,
      nextPath: safeRedirectPath(payload.nextPath),
      purpose: "login_2fa",
      issuedAt: Date.now()
    }),
    "utf8"
  ).toString("base64url");
  return signValue(encoded);
}

export function decodePendingLogin(signedValue: string | undefined): PendingLoginPayload | null {
  if (!signedValue) return null;
  const encoded = verifySignedValue(signedValue);
  if (!encoded) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as PendingLoginPayload;
    if (payload.purpose !== "login_2fa" || !payload.userId || !payload.email || !payload.issuedAt) return null;
    if (Date.now() - payload.issuedAt > PENDING_LOGIN_MAX_AGE_SECONDS * 1000) return null;
    return {
      ...payload,
      nextPath: safeRedirectPath(payload.nextPath)
    };
  } catch {
    return null;
  }
}
