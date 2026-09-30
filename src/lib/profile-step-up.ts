import { hashToken } from "./crypto";
import { verifyPassword } from "./password";
import { prisma } from "./prisma";
import { decodeProfileVerification, profileVerificationUseKey, PROFILE_VERIFICATION_COOKIE, type ProfileVerificationAction } from "./profile-verification";
import { checkRateLimit } from "./rate-limit";
import { getSetting } from "./settings";
import { verifyTotpCode } from "./totp";

type StepUpInput = {
  userId: string;
  sessionId: string;
  sessionCreatedAt: Date;
  passwordHash: string | null;
  action: ProfileVerificationAction | "backup-codes-delete";
  resourceId?: string;
  method: string;
  code?: string;
  password?: string;
  proofCookie?: string;
  totpOnly?: boolean;
};

export async function verifyProfileStepUp(input: StepUpInput): Promise<{ error?: string; usedProvider?: boolean }> {
  const credential = await prisma.totpCredential.findUnique({ where: { userId: input.userId } });
  const totpEnabled = Boolean(credential?.enabled);
  if (input.totpOnly && !totpEnabled) return { error: "TOTP must be enabled to manage backup codes." };
  if (input.method === "provider") {
    const proof = decodeProfileVerification(input.proofCookie);
    if (!proof || proof.userId !== input.userId || proof.sessionId !== input.sessionId ||
        proof.action !== input.action || proof.resourceId !== input.resourceId ||
        (totpEnabled && !proof.mfaVerified)) return { error: "Verify with a linked provider again." };
    const used = await checkRateLimit(profileVerificationUseKey(proof.nonce), 1, 5 * 60 * 1000);
    return used.allowed ? { usedProvider: true } : { error: "That verification was already used. Verify again." };
  }
  if (totpEnabled && credential) {
    const establishedAt = credential.enabledAt ?? credential.createdAt;
    if (!establishedAt || input.sessionCreatedAt < establishedAt) return { error: "Sign in again with your authenticator before changing security settings." };
    if (input.method !== "totp") return { error: "Enter a current authenticator code." };
    const code = String(input.code ?? "").trim();
    const rate = await checkRateLimit(`profile:step-up:${input.userId}`, 5, 15 * 60 * 1000);
    if (!rate.allowed) return { error: "Too many verification attempts. Please wait and try again." };
    if (!/^[0-9]{6}$/.test(code) || !(await verifyTotpCode(credential.secretEncrypted, code))) {
      return { error: "Enter a valid current authenticator code." };
    }
    const used = await checkRateLimit(`profile:totp-code:${input.userId}:${hashToken(code)}`, 1, 90 * 1000);
    return used.allowed ? {} : { error: "That authenticator code was already used. Wait for the next code." };
  }
  if (input.method !== "password") return { error: "Enter your current password or verify with a linked provider." };
  if (!(await getSetting("localLoginEnabled"))) return { error: "Verify with a linked provider." };
  const password = String(input.password ?? "");
  if (!password || password.length > 4096) return { error: "Enter your current password." };
  const rate = await checkRateLimit(`profile:step-up:${input.userId}`, 5, 15 * 60 * 1000);
  if (!rate.allowed) return { error: "Too many verification attempts. Please wait and try again." };
  if (!input.passwordHash || !(await verifyPassword(input.passwordHash, password))) return { error: "Incorrect current password." };
  return {};
}

export { PROFILE_VERIFICATION_COOKIE };
