import type { WebAuthnCredential } from "@simplewebauthn/server";
import type { Passkey } from "@prisma/client";
import { signValue, verifySignedValue } from "./crypto";
import { isProduction } from "./env";

export const PASSKEY_REGISTRATION_COOKIE = "surls_passkey_registration";
export const PASSKEY_AUTHENTICATION_COOKIE = "surls_passkey_authentication";
export const PASSKEY_CHALLENGE_MAX_AGE_SECONDS = 5 * 60;

type PasskeyChallengePayload = {
  challenge: string;
  issuedAt: number;
  name?: string;
  purpose: "registration" | "authentication";
  sessionId?: string;
  userId?: string;
};

type PasskeyTransport = NonNullable<WebAuthnCredential["transports"]>[number];

const transports = new Set<PasskeyTransport>([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb"
]);

export function passkeyCookieOptions() {
  return {
    httpOnly: true,
    maxAge: PASSKEY_CHALLENGE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: isProduction()
  };
}

export function expiredPasskeyCookieOptions() {
  return {
    httpOnly: true,
    expires: new Date(0),
    maxAge: 0,
    path: "/",
    sameSite: "lax" as const,
    secure: isProduction()
  };
}

export function encodePasskeyChallenge(payload: Omit<PasskeyChallengePayload, "issuedAt">) {
  const encoded = Buffer.from(JSON.stringify({ ...payload, issuedAt: Date.now() }), "utf8").toString("base64url");
  return signValue(encoded);
}

export function decodePasskeyChallenge(
  signedValue: string | undefined,
  purpose: PasskeyChallengePayload["purpose"]
): PasskeyChallengePayload | null {
  if (!signedValue) return null;
  const encoded = verifySignedValue(signedValue);
  if (!encoded) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as PasskeyChallengePayload;
    if (payload.purpose !== purpose || !payload.challenge || !payload.issuedAt ||
        (purpose === "registration" && (!payload.sessionId || !payload.userId))) return null;
    if (Date.now() - payload.issuedAt >= PASSKEY_CHALLENGE_MAX_AGE_SECONDS * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function cleanPasskeyName(value: unknown) {
  const text = String(value ?? "").trim();
  return (text || "Passkey").slice(0, 80);
}

export function uint8ArrayToBase64Url(value: Uint8Array) {
  return Buffer.from(value).toString("base64url");
}

export function base64UrlToUint8Array(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

export function parsePasskeyTransports(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const valid = parsed.filter((transport): transport is PasskeyTransport => {
      return typeof transport === "string" && transports.has(transport as PasskeyTransport);
    });
    return valid.length ? valid : undefined;
  } catch {
    return undefined;
  }
}

export function passkeyToWebAuthnCredential(
  passkey: Pick<Passkey, "credentialId" | "publicKey" | "counter" | "transports">
): WebAuthnCredential {
  return {
    id: passkey.credentialId,
    publicKey: base64UrlToUint8Array(passkey.publicKey),
    counter: Number(passkey.counter),
    transports: parsePasskeyTransports(passkey.transports)
  };
}
