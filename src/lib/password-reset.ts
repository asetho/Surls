import { AuditAction } from "@prisma/client";
import { auditLog } from "./audit";
import { hashToken, randomToken } from "./crypto";
import { appBaseUrl } from "./env";
import { hashPassword } from "./password";
import { prisma } from "./prisma";
import { sendPasswordChangedEmail, sendPasswordResetEmail } from "./profile-email";
import { getSetting } from "./settings";
import { getSmtpTransportConfig } from "./smtp-settings";

const RESET_LIFETIME_MS = 15 * 60 * 1000;
const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
class PasswordResetStateChangedError extends Error {}
export const PASSWORD_RESET_GENERIC_MESSAGE = "If this account can reset its password, an email will arrive shortly.";

export async function passwordResetAvailable() {
  const [enabled, localLoginEnabled, smtp] = await Promise.all([
    getSetting("emailPasswordResetsEnabled"), getSetting("localLoginEnabled"), getSmtpTransportConfig()
  ]);
  return enabled === true && localLoginEnabled === true && Boolean(smtp);
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, passwordResetEligible: true } });
  if (!user?.passwordResetEligible || !(await passwordResetAvailable())) return;

  const token = randomToken(32);
  const tokenHash = hashToken(token);
  const emailHash = hashToken(user.email);
  const expiresAt = new Date(Date.now() + RESET_LIFETIME_MS);
  await prisma.passwordResetToken.upsert({
    where: { userId: user.id },
    create: { userId: user.id, tokenHash, emailHash, expiresAt },
    update: { tokenHash, emailHash, expiresAt }
  });

  const url = new URL("/reset-password", appBaseUrl());
  url.searchParams.set("token", token);
  try {
    await sendPasswordResetEmail(user.email, url.toString());
  } catch {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, tokenHash } });
    console.error("Password reset email delivery failed.");
  }
}

export type PasswordResetResult = "success" | "invalid" | "disabled";

export async function completePasswordReset(token: string, newPassword: string): Promise<PasswordResetResult> {
  if (!(await passwordResetAvailable())) return "disabled";
  if (!RESET_TOKEN_PATTERN.test(token) || newPassword.length < 12 || newPassword.length > 4096) return "invalid";
  const tokenHash = hashToken(token);
  const current = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, select: { expiresAt: true } });
  if (!current || current.expiresAt <= new Date()) return "invalid";
  const passwordHash = await hashPassword(newPassword);
  const now = new Date();
  let user: { id: string; email: string } | null;
  try {
    user = await prisma.$transaction(async (tx) => {
      const reset = await tx.passwordResetToken.findUnique({ where: { tokenHash }, select: { userId: true, emailHash: true, expiresAt: true } });
      if (!reset || reset.expiresAt <= now) return null;
      const owner = await tx.user.findUnique({ where: { id: reset.userId }, select: { id: true, email: true, passwordResetEligible: true } });
      if (!owner?.passwordResetEligible || hashToken(owner.email) !== reset.emailHash) return null;
      const consumed = await tx.passwordResetToken.deleteMany({ where: { userId: owner.id, tokenHash, expiresAt: { gt: now } } });
      if (consumed.count !== 1) return null;
      const updated = await tx.user.updateMany({ where: { id: owner.id, email: owner.email, passwordResetEligible: true }, data: { passwordHash } });
      if (updated.count !== 1) throw new PasswordResetStateChangedError();
      await tx.session.deleteMany({ where: { userId: owner.id } });
      return owner;
    });
  } catch (error) {
    if (error instanceof PasswordResetStateChangedError) return "invalid";
    throw error;
  }
  if (!user) return "invalid";
  await auditLog({ userId: user.id, action: AuditAction.PASSWORD_RESET_COMPLETED }).catch(() => null);
  await sendPasswordChangedEmail(user.email).catch(() => null);
  return "success";
}
