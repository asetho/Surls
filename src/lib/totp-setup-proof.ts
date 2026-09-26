import { hashToken, randomToken, signValue, verifySignedValue } from "./crypto";
import { isProduction } from "./env";

export const TOTP_SETUP_PROOF_COOKIE = "surls_totp_setup_proof";
const MAX_AGE_SECONDS = 5 * 60;

type TotpSetupProof = {
  purpose: "totp-setup";
  userId: string;
  sessionId: string;
  nonce: string;
  issuedAt: number;
};

export function totpSetupProofCookieOptions() {
  return { httpOnly: true, secure: isProduction(), sameSite: "lax" as const, path: "/admin/profile", maxAge: MAX_AGE_SECONDS };
}

export function encodeTotpSetupProof(userId: string, sessionId: string) {
  const payload: TotpSetupProof = { purpose: "totp-setup", userId, sessionId, nonce: randomToken(), issuedAt: Date.now() };
  return signValue(Buffer.from(JSON.stringify(payload)).toString("base64url"));
}

export function decodeTotpSetupProof(value: string | undefined): TotpSetupProof | null {
  if (!value || value.length > 2048) return null;
  const encoded = verifySignedValue(value);
  if (!encoded) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TotpSetupProof;
    if (payload.purpose !== "totp-setup" || typeof payload.userId !== "string" || !payload.userId ||
        typeof payload.sessionId !== "string" || !payload.sessionId ||
        typeof payload.nonce !== "string" || payload.nonce.length < 30 ||
        !Number.isSafeInteger(payload.issuedAt) || payload.issuedAt > Date.now() + 30_000 ||
        Date.now() - payload.issuedAt > MAX_AGE_SECONDS * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function totpSetupProofUseKey(nonce: string) {
  return `profile:totp-setup:${hashToken(nonce)}`;
}
