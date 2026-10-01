"use server";

import { AuditAction, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auditLog } from "@/lib/audit";
import { getCurrentSession, requireAdmin, requireSiteAdmin } from "@/lib/auth";
import { hashToken } from "@/lib/crypto";
import { generateBackupCodes, hashBackupCode } from "@/lib/backup-codes";
import { consumeBackupCode, matchingBackupCodeId } from "@/lib/backup-code-proof";
import { validateCsrf } from "@/lib/csrf";
import { normalizeMobileMenuSide } from "@/lib/mobile-menu";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { profileEmailAvailable, sendProfileEmailCode, sendTotpSetupEmailCode } from "@/lib/profile-email";
import { createProfileEmailCode, decodeProfileEmailCode, PROFILE_EMAIL_CODE_COOKIE, profileEmailCodeCookieOptions, verifyProfileEmailCode } from "@/lib/profile-email-code";
import { decodeProfileVerification, PROFILE_VERIFICATION_COOKIE, profileVerificationCookieOptions, profileVerificationUseKey } from "@/lib/profile-verification";
import { verifyProfileStepUp } from "@/lib/profile-step-up";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSetting, getSiteName } from "@/lib/settings";
import { createTotpSecret, verifyTotpCode } from "@/lib/totp";
import { createTotpEnrollment, decodeTotpEnrollment, decodeTotpSetup, encodeTotpSetup, TOTP_ENROLLMENT_COOKIE, TOTP_SETUP_COOKIE, totpEnrollmentCookieOptions, totpSetupCookieOptions } from "@/lib/totp-enrollment";
import { createTotpSetupEmailCode, decodeTotpSetupEmailCode, TOTP_SETUP_EMAIL_CODE_COOKIE, totpSetupEmailCodeCookieOptions, verifyTotpSetupEmailCode } from "@/lib/totp-setup-email-code";
import { decodeTotpSetupProof, TOTP_SETUP_PROOF_COOKIE, totpSetupProofCookieOptions, totpSetupProofUseKey } from "@/lib/totp-setup-proof";
import { normalizeUserProfileFormData } from "@/lib/user-profile";

type ProfileActionState = {
  error?: string;
  message?: string;
  verificationRequired?: "totp" | "email";
};
class ProfileBackupStateChangedError extends Error {}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function updateProfileAction(
  _state: ProfileActionState | null,
  formData: FormData
): Promise<ProfileActionState> {
  try {
    validateCsrf(formData);
  } catch {
    return { error: "The form expired. Please refresh and try again." };
  }

  const user = await requireAdmin();
  if (!user) redirect("/admin?next=/admin/profile");

  const parsed = normalizeUserProfileFormData(formData);
  if (parsed.error) return { error: parsed.error };
  if (!parsed.data) return { error: "Enter a valid email address." };
  const profile = {
    ...parsed.data,
    mobileMenuSide: normalizeMobileMenuSide(formData.get("mobileMenuSide"))
  };

  const emailChanged = profile.email !== user.email.trim().toLowerCase();
  const existing = await prisma.user.findFirst({
    where: {
      email: profile.email,
      NOT: { id: user.id }
    },
    select: { id: true }
  });
  if (existing) return { error: "A user with that email already exists." };

  let usedProviderVerification = false;
  let usedEmailCode = false;
  let backupCodeId: string | null = null;
  let verificationSessionId: string | null = null;
  if (emailChanged) {
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.userId !== user.id) return { error: "Sign in again before changing your email." };
    verificationSessionId = currentSession.id;
    const jar = await cookies();
    const providerVerification = decodeProfileVerification(jar.get(PROFILE_VERIFICATION_COOKIE)?.value);
    const providerVerified = providerVerification?.userId === user.id && providerVerification.sessionId === currentSession.id &&
      providerVerification.action === "email-change" && providerVerification.pendingEmail === profile.email &&
      (!user.totpCredential?.enabled || providerVerification.mfaVerified);
    const code = formData.get("resendCode") === "yes" ? "" : String(formData.get("verificationCode") ?? "").trim();

    if (user.totpCredential?.enabled && providerVerified) {
      const use = await checkRateLimit(profileVerificationUseKey(providerVerification.nonce), 1, 5 * 60 * 1000);
      if (!use.allowed) return { error: "That verification was already used. Verify again before changing your email." };
      usedProviderVerification = true;
    } else if (user.totpCredential?.enabled) {
      const establishedAt = user.totpCredential.enabledAt ?? user.totpCredential.createdAt;
      if (!establishedAt || establishedAt > currentSession.createdAt) {
        return { error: "Sign in again before using a newly enabled authenticator to change your email.", verificationRequired: "totp" };
      }
      if (!code) return { verificationRequired: "totp" };
      const rate = await checkRateLimit(`profile:email-verification:${user.id}`, 5, 15 * 60 * 1000);
      if (!rate.allowed) return { error: "Too many verification attempts. Please wait and try again.", verificationRequired: "totp" };
      if (/^[0-9]{6}$/.test(code)) {
        if (!(await verifyTotpCode(user.totpCredential.secretEncrypted, code))) return { error: "Invalid authenticator code.", verificationRequired: "totp" };
        const used = await checkRateLimit(`profile:totp-code:${user.id}:${hashToken(code)}`, 1, 90 * 1000);
        if (!used.allowed) return { error: "That authenticator code was already used. Wait for the next code.", verificationRequired: "totp" };
      } else {
        backupCodeId = await matchingBackupCodeId(user.id, code);
        if (!backupCodeId) return { error: "Invalid backup code.", verificationRequired: "totp" };
      }
    } else if (code) {
      const rate = await checkRateLimit(`profile:email-verification:${user.id}`, 5, 15 * 60 * 1000);
      if (!rate.allowed) return { error: "Too many verification attempts. Please wait and try again.", verificationRequired: "email" };
      const proof = decodeProfileEmailCode(jar.get(PROFILE_EMAIL_CODE_COOKIE)?.value);
      if (!proof || proof.userId !== user.id || proof.sessionId !== currentSession.id ||
          proof.currentEmail !== user.email || proof.pendingEmail !== profile.email || !verifyProfileEmailCode(proof, code)) {
        return { error: "Invalid or expired email verification code.", verificationRequired: "email" };
      }
      if (providerVerified) {
        const providerUse = await checkRateLimit(profileVerificationUseKey(providerVerification.nonce), 1, 5 * 60 * 1000);
        if (!providerUse.allowed) return { error: "That provider verification was already used. Verify again.", verificationRequired: "email" };
        usedProviderVerification = true;
      } else {
        if (!(await getSetting("localLoginEnabled"))) return { error: "Verify with a linked provider to change your email.", verificationRequired: "email" };
        const password = String(formData.get("password") ?? "");
        const passwordRate = await checkRateLimit(`profile:email-password:${user.id}`, 5, 15 * 60 * 1000);
        if (!passwordRate.allowed) return { error: "Too many password attempts. Please wait and try again.", verificationRequired: "email" };
        if (!password || password.length > 4096 || !(await verifyPassword(user.passwordHash, password))) {
          return { error: "Enter your current Surls password or verify with a linked provider.", verificationRequired: "email" };
        }
      }
      const used = await checkRateLimit(`profile:email-code:${hashToken(proof.nonce)}`, 1, 10 * 60 * 1000);
      if (!used.allowed) return { error: "That email verification code was already used.", verificationRequired: "email" };
      usedEmailCode = true;
    } else {
      if (!(await profileEmailAvailable())) return { error: "Email verification is not configured. Ask a site administrator to set up SMTP or verify with a linked provider.", verificationRequired: "email" };
      const rate = await checkRateLimit(`profile:email-code-send:${user.id}`, 3, 15 * 60 * 1000);
      if (!rate.allowed) return { error: "Too many codes requested. Please wait and try again." };
      const generated = createProfileEmailCode(user.id, currentSession.id, user.email, profile.email);
      try {
        await sendProfileEmailCode(user.email, generated.code);
      } catch {
        return { error: "Could not send a verification code. Please try again later." };
      }
      jar.set(PROFILE_EMAIL_CODE_COOKIE, generated.cookie, profileEmailCodeCookieOptions());
      return { verificationRequired: "email", message: `Verification code sent to ${user.email}.` };
    }
  }

  try {
    if (backupCodeId) {
      const consumed = await prisma.$transaction(async (tx) => {
        await lockUserSecurityState(tx, user.id);
        const liveSession = await lockActiveSessionForUser(tx, verificationSessionId!, user.id);
        const liveCredential = await tx.totpCredential.findUnique({ where: { userId: user.id } });
        if (!liveSession || !liveCredential?.enabled || liveCredential.id !== user.totpCredential?.id ||
            liveCredential.secretEncrypted !== user.totpCredential?.secretEncrypted ||
            !(await consumeBackupCode(tx, user.id, backupCodeId))) return false;
        if ((await tx.user.updateMany({ where: { id: user.id, email: user.email }, data: profile })).count !== 1) {
          throw new ProfileBackupStateChangedError();
        }
        return true;
      });
      if (!consumed) return { error: "That backup code or session is no longer valid. Sign in again or use another code.", verificationRequired: "totp" };
    } else {
      await prisma.user.update({ where: { id: user.id }, data: profile });
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) return { error: "A user with that email already exists." };
    if (error instanceof ProfileBackupStateChangedError) return { error: "Your account changed. Sign in again before changing your email.", verificationRequired: "totp" };
    throw error;
  }

  if (usedProviderVerification) (await cookies()).set(PROFILE_VERIFICATION_COOKIE, "", { ...profileVerificationCookieOptions(), maxAge: 0 });
  if (usedEmailCode) (await cookies()).set(PROFILE_EMAIL_CODE_COOKIE, "", { ...profileEmailCodeCookieOptions(), maxAge: 0 });
  if (backupCodeId) await auditLog({ userId: user.id, action: AuditAction.BACKUP_CODE_USED });

  revalidatePath("/admin/profile");
  revalidatePath("/admin", "layout");
  return { message: "Profile updated." };
}

type TotpStartState = { error?: string; started?: boolean };
type TotpEmailCodeState = { error?: string; message?: string; sent?: boolean };

export async function sendTotpSetupEmailCodeAction(_state: TotpEmailCodeState | null, formData: FormData): Promise<TotpEmailCodeState> {
  try {
    validateCsrf(formData);
  } catch {
    return { error: "The form expired. Please refresh and try again." };
  }
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const session = await getCurrentSession();
  if (!session || session.userId !== admin.id) return { error: "Sign in again before starting TOTP setup." };
  if ((await prisma.totpCredential.findUnique({ where: { userId: admin.id } }))?.enabled) {
    return { error: "TOTP is already enabled." };
  }
  if (!(await getSetting("localLoginEnabled"))) return { error: "Use a linked provider to verify your account." };
  if (!(await profileEmailAvailable())) return { error: "Email verification is unavailable. Use your password or a linked provider." };
  const rate = await checkRateLimit(`profile:totp-setup-email-send:${admin.id}`, 3, 15 * 60 * 1000);
  if (!rate.allowed) return { error: "Too many codes requested. Please wait and try again." };
  const generated = createTotpSetupEmailCode(admin.id, session.id, admin.email);
  try {
    await sendTotpSetupEmailCode(admin.email, generated.code);
  } catch {
    return { error: "Could not send a verification code. Please try again later." };
  }
  (await cookies()).set(TOTP_SETUP_EMAIL_CODE_COOKIE, generated.cookie, totpSetupEmailCodeCookieOptions());
  return { sent: true, message: `Verification code sent to ${admin.email}.` };
}

export async function startTotpAction(_state: TotpStartState | null, formData: FormData): Promise<TotpStartState> {
  try {
    validateCsrf(formData);
  } catch {
    return { error: "The form expired. Please refresh and try again." };
  }
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const session = await getCurrentSession();
  if (!session || session.userId !== admin.id) return { error: "Sign in again before starting TOTP setup." };
  const existing = await prisma.totpCredential.findUnique({ where: { userId: admin.id } });
  if (existing?.enabled) return { error: "TOTP is already enabled." };
  const jar = await cookies();
  const method = formData.get("method");
  if (method === "password") {
    if (!(await getSetting("localLoginEnabled"))) return { error: "Use a linked provider to verify your account." };
    const rate = await checkRateLimit(`profile:totp-setup-password:${admin.id}`, 5, 15 * 60 * 1000);
    if (!rate.allowed) return { error: "Too many password attempts. Please wait and try again." };
    const password = String(formData.get("password") ?? "");
    if (!password || password.length > 4096 || !(await verifyPassword(admin.passwordHash, password))) return { error: "Enter your current Surls password." };
  } else if (method === "email") {
    if (!(await getSetting("localLoginEnabled"))) return { error: "Use a linked provider to verify your account." };
    const rate = await checkRateLimit(`profile:totp-setup-email-verify:${admin.id}`, 5, 15 * 60 * 1000);
    if (!rate.allowed) return { error: "Too many verification attempts. Please wait and try again." };
    const password = String(formData.get("password") ?? "");
    if (!password || password.length > 4096 || !(await verifyPassword(admin.passwordHash, password))) {
      return { error: "Enter your current Surls password along with the email code." };
    }
    const code = String(formData.get("code") ?? "").trim();
    const proof = decodeTotpSetupEmailCode(jar.get(TOTP_SETUP_EMAIL_CODE_COOKIE)?.value);
    if (!proof || proof.userId !== admin.id || proof.sessionId !== session.id || proof.currentEmail !== admin.email ||
        !verifyTotpSetupEmailCode(proof, code)) return { error: "Invalid or expired email verification code." };
    const used = await checkRateLimit(`profile:totp-setup-email-code:${hashToken(proof.nonce)}`, 1, 10 * 60 * 1000);
    if (!used.allowed) return { error: "That email verification code was already used." };
  } else if (method === "provider") {
    const proof = decodeTotpSetupProof(jar.get(TOTP_SETUP_PROOF_COOKIE)?.value);
    if (!proof || proof.userId !== admin.id || proof.sessionId !== session.id) {
      return { error: "Verify with your linked provider again before starting TOTP setup." };
    }
    const used = await checkRateLimit(totpSetupProofUseKey(proof.nonce), 1, 5 * 60 * 1000);
    if (!used.allowed) return { error: "That linked-provider verification was already used. Verify again." };
  } else {
    return { error: "Choose how to verify your account before starting TOTP setup." };
  }
  const secret = createTotpSecret(admin.email, await getSiteName());
  jar.set(TOTP_ENROLLMENT_COOKIE, "", { ...totpEnrollmentCookieOptions(), maxAge: 0 });
  jar.set(TOTP_SETUP_COOKIE, encodeTotpSetup(admin.id, session.id, secret.encryptedSecret), totpSetupCookieOptions());
  if (method === "email") jar.set(TOTP_SETUP_EMAIL_CODE_COOKIE, "", { ...totpSetupEmailCodeCookieOptions(), maxAge: 0 });
  if (method === "provider") jar.set(TOTP_SETUP_PROOF_COOKIE, "", { ...totpSetupProofCookieOptions(), maxAge: 0 });
  revalidatePath("/admin/profile");
  return { started: true };
}

export async function cancelTotpSetupAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const session = await getCurrentSession();
  if (!session || session.userId !== admin.id) throw new Error("Unauthorized");
  const jar = await cookies();
  const setup = decodeTotpSetup(jar.get(TOTP_SETUP_COOKIE)?.value);
  if (!setup || setup.userId !== admin.id || setup.sessionId !== session.id) return;
  jar.set(TOTP_ENROLLMENT_COOKIE, "", { ...totpEnrollmentCookieOptions(), maxAge: 0 });
  jar.set(TOTP_SETUP_COOKIE, "", { ...totpSetupCookieOptions(), maxAge: 0 });
  revalidatePath("/admin/profile");
}

type TotpEnrollmentState = { codes?: string[]; confirmationNonce?: string; error?: string; complete?: boolean };

export async function enrollTotpAction(_state: TotpEnrollmentState | null, formData: FormData): Promise<TotpEnrollmentState> {
  try {
    validateCsrf(formData);
  } catch {
    return { error: "The form expired. Please refresh and try again." };
  }
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const session = await getCurrentSession();
  if (!session || session.userId !== admin.id) return { error: "Sign in again to finish TOTP setup." };
  const jar = await cookies();
  const setup = decodeTotpSetup(jar.get(TOTP_SETUP_COOKIE)?.value);
  if (!setup || setup.userId !== admin.id || setup.sessionId !== session.id) return { error: "Start TOTP setup again." };
  const credential = await prisma.totpCredential.findUnique({ where: { userId: admin.id } });
  if (credential?.enabled) return { error: "TOTP is already enabled." };

  if (formData.get("step") === "verify") {
    const rate = await checkRateLimit(`profile:enroll-totp:${admin.id}`, 5, 15 * 60 * 1000);
    if (!rate.allowed) return { error: "Too many verification attempts. Please wait and try again." };
    const code = String(formData.get("code") ?? "").trim();
    if (!code || !(await verifyTotpCode(setup.secretEncrypted, code))) return { error: "Enter a valid authenticator code." };
    const used = await checkRateLimit(`profile:totp-code:${admin.id}:${hashToken(code.replace(/\s+/g, ""))}`, 1, 90 * 1000);
    if (!used.allowed) return { error: "That authenticator code was already used. Wait for the next code." };
    const codes = generateBackupCodes();
    const confirmation = createTotpEnrollment(admin.id, session.id, setup.secretEncrypted, codes);
    jar.set(TOTP_ENROLLMENT_COOKIE, confirmation.cookie, totpEnrollmentCookieOptions());
    return { codes, confirmationNonce: confirmation.nonce };
  }

  if (formData.get("step") !== "confirm" || formData.get("codesSaved") !== "yes") {
    return { error: "Confirm that you saved your backup codes before enabling TOTP." };
  }
  const pending = decodeTotpEnrollment(jar.get(TOTP_ENROLLMENT_COOKIE)?.value);
  if (!pending || pending.userId !== admin.id || pending.sessionId !== session.id ||
      pending.secretFingerprint !== hashToken(setup.secretEncrypted) || pending.nonce !== formData.get("confirmationNonce")) {
    return { error: "Backup code confirmation expired. Verify a new authenticator code to start again." };
  }
  const used = await checkRateLimit(`profile:totp-enrollment:${hashToken(pending.nonce)}`, 1, 10 * 60 * 1000);
  if (!used.allowed) return { error: "This backup code confirmation was already used." };
  const codeHashes = await Promise.all(pending.codes.map(hashBackupCode));
  let outcome: "enabled" | "session" | "changed";
  try {
    outcome = await prisma.$transaction(async (tx) => {
      await lockUserSecurityState(tx, admin.id);
      const liveSession = await lockActiveSessionForUser(tx, session.id, admin.id);
      if (!liveSession) return "session" as const;
      const current = await tx.totpCredential.findUnique({ where: { userId: admin.id } });
      const enabledAt = new Date();
      if (current) {
        const updated = await tx.totpCredential.updateMany({
          where: { id: current.id, userId: admin.id, enabled: false },
          data: { secretEncrypted: setup.secretEncrypted, enabled: true, enabledAt }
        });
        if (updated.count !== 1) return "changed" as const;
      } else {
        await tx.totpCredential.create({
          data: { userId: admin.id, secretEncrypted: setup.secretEncrypted, enabled: true, enabledAt }
        });
      }
      await tx.backupCode.deleteMany({ where: { userId: admin.id } });
      await tx.backupCode.createMany({
        data: codeHashes.map((codeHash) => ({ userId: admin.id, codeHash }))
      });
      await tx.session.deleteMany({ where: { userId: admin.id, id: { not: session.id } } });
      return "enabled" as const;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) return { error: "TOTP setup changed. Start again." };
    throw error;
  }
  if (outcome === "session") return { error: "Sign in again to finish TOTP setup." };
  if (outcome !== "enabled") return { error: "TOTP setup changed. Start again." };
  jar.set(TOTP_ENROLLMENT_COOKIE, "", { ...totpEnrollmentCookieOptions(), maxAge: 0 });
  jar.set(TOTP_SETUP_COOKIE, "", { ...totpSetupCookieOptions(), maxAge: 0 });
  await auditLog({ userId: admin.id, action: AuditAction.TOTP_ENABLED });
  await auditLog({ userId: admin.id, action: AuditAction.BACKUP_CODES_REGENERATED });
  revalidatePath("/admin/profile");
  return { complete: true };
}

export async function disableTotpAction(_state: ProfileActionState | null, formData: FormData): Promise<ProfileActionState> {
  try {
    validateCsrf(formData);
  } catch {
    return { error: "The form expired. Please refresh and try again." };
  }
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const session = await getCurrentSession();
  if (!session || session.userId !== admin.id) return { error: "Sign in again before disabling TOTP." };
  const rate = await checkRateLimit(`profile:disable-totp:${admin.id}`, 5, 15 * 60 * 1000);
  if (!rate.allowed) return { error: "Too many verification attempts. Please wait and try again." };
  const credential = await prisma.totpCredential.findUnique({ where: { userId: admin.id } });
  if (!credential?.enabled) return { error: "TOTP is no longer enabled." };
  const code = String(formData.get("code") ?? "").trim();
  let backupCodeId: string | null = null;
  if (/^[0-9]{6}$/.test(code)) {
    if (!(await verifyTotpCode(credential.secretEncrypted, code))) return { error: "Enter a valid current authenticator code or backup code." };
    const used = await checkRateLimit(`profile:totp-code:${admin.id}:${hashToken(code)}`, 1, 90 * 1000);
    if (!used.allowed) return { error: "That authenticator code was already used. Wait for the next code." };
  } else {
    backupCodeId = await matchingBackupCodeId(admin.id, code);
    if (!backupCodeId) return { error: "Enter a valid current authenticator code or backup code." };
  }
  let deleted: { count: number } | null;
  try {
    deleted = await prisma.$transaction(async (tx) => {
      await lockUserSecurityState(tx, admin.id);
      const liveSession = await lockActiveSessionForUser(tx, session.id, admin.id);
      const establishedAt = credential.enabledAt ?? credential.createdAt;
      if (!liveSession || (backupCodeId && (!establishedAt || liveSession.createdAt < establishedAt))) return null;
      if (backupCodeId && !(await consumeBackupCode(tx, admin.id, backupCodeId))) return null;
      const result = await tx.totpCredential.deleteMany({
        where: {
          id: credential.id, userId: admin.id, enabled: true,
          enabledAt: credential.enabledAt, secretEncrypted: credential.secretEncrypted
        }
      });
      if (backupCodeId && result.count !== 1) throw new ProfileBackupStateChangedError();
      return result;
    });
  } catch (error) {
    if (error instanceof ProfileBackupStateChangedError) return { error: "TOTP changed. Sign in again before disabling it." };
    throw error;
  }
  if (!deleted) return { error: "Sign in again before disabling TOTP." };
  if (!deleted.count) return { error: "TOTP is no longer enabled." };
  if (backupCodeId) await auditLog({ userId: admin.id, action: AuditAction.BACKUP_CODE_USED });
  await auditLog({ userId: admin.id, action: AuditAction.TOTP_DISABLED });
  revalidatePath("/admin/profile");
  return { message: "TOTP disabled." };
}

type BackupCodesState = { codes?: string[]; generatedAt?: string; error?: string };

async function lockUserSecurityState(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}

async function lockActiveSessionForUser(tx: Prisma.TransactionClient, sessionId: string, userId: string) {
  const rows = await tx.$queryRaw<Array<{ userId: string; createdAt: Date; expiresAt: Date }>>`
    SELECT "userId", "createdAt", "expiresAt" FROM "Session"
    WHERE "id" = ${sessionId} AND "userId" = ${userId} FOR UPDATE
  `;
  const session = rows[0];
  return session && session.expiresAt > new Date() ? session : null;
}

export async function regenerateBackupCodesAction(_state: BackupCodesState | null, formData: FormData): Promise<BackupCodesState> {
  try {
    validateCsrf(formData);
  } catch {
    return { error: "The form expired. Please refresh and try again." };
  }
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const session = await getCurrentSession();
  if (!session || session.userId !== admin.id) return { error: "Sign in again before regenerating backup codes." };
  const credential = await prisma.totpCredential.findUnique({ where: { userId: admin.id } });
  if (!credential?.enabled) return { error: "Enable TOTP before generating backup codes." };
  const establishedAt = credential.enabledAt ?? credential.createdAt;
  if (!establishedAt || !session.createdAt || session.createdAt < establishedAt) {
    return { error: "Sign in again after enabling TOTP before regenerating backup codes." };
  }
  const rate = await checkRateLimit(`profile:backup-codes:${admin.id}`, 3, 15 * 60 * 1000);
  if (!rate.allowed) return { error: "Too many backup code regeneration attempts. Please wait and try again." };
  const code = String(formData.get("code") ?? "").trim();
  let backupCodeId: string | null = null;
  if (/^[0-9]{6}$/.test(code)) {
    if (!(await verifyTotpCode(credential.secretEncrypted, code))) return { error: "Enter a valid current authenticator code or backup code." };
    const used = await checkRateLimit(`profile:totp-code:${admin.id}:${hashToken(code)}`, 1, 90 * 1000);
    if (!used.allowed) return { error: "That authenticator code was already used. Wait for the next code." };
  } else {
    backupCodeId = await matchingBackupCodeId(admin.id, code);
    if (!backupCodeId) return { error: "Enter a valid current authenticator code or backup code." };
  }
  const generatedAt = new Date();
  const codes = generateBackupCodes();
  const hashedCodes = await Promise.all(codes.map(async (code) => ({ code, codeHash: await hashBackupCode(code) })));
  const regenerated = await prisma.$transaction(async (tx) => {
    await lockUserSecurityState(tx, admin.id);
    const liveSession = await lockActiveSessionForUser(tx, session.id, admin.id);
    if (!liveSession || liveSession.createdAt < establishedAt) return false;
    const liveCredential = await tx.totpCredential.findUnique({ where: { userId: admin.id } });
    if (!liveCredential?.enabled || liveCredential.id !== credential.id ||
        (liveCredential.enabledAt?.getTime() ?? null) !== (credential.enabledAt?.getTime() ?? null) ||
        liveCredential.secretEncrypted !== credential.secretEncrypted) return false;
    if (backupCodeId && !(await consumeBackupCode(tx, admin.id, backupCodeId))) return false;
    await tx.backupCode.deleteMany({ where: { userId: admin.id } });
    await tx.backupCode.createMany({
      data: hashedCodes.map(({ codeHash }) => ({ userId: admin.id, codeHash, createdAt: generatedAt }))
    });
    return true;
  });
  if (!regenerated) return { error: "Your session or authenticator changed. Sign in again before regenerating backup codes." };
  if (backupCodeId) await auditLog({ userId: admin.id, action: AuditAction.BACKUP_CODE_USED });
  await auditLog({ userId: admin.id, action: AuditAction.BACKUP_CODES_REGENERATED });
  revalidatePath("/admin/profile");
  return { codes, generatedAt: generatedAt.toISOString() };
}

export async function deleteBackupCodesAction(_state: { error?: string; deleted?: boolean } | null, formData: FormData): Promise<{ error?: string; deleted?: boolean }> {
  try { validateCsrf(formData); } catch { return { error: "The form expired. Please refresh and try again." }; }
  const admin = await requireSiteAdmin();
  if (!admin) throw new Error("Unauthorized");
  const session = await getCurrentSession();
  if (!session || session.userId !== admin.id) return { error: "Sign in again before deleting backup codes." };
  const credential = await prisma.totpCredential.findUnique({ where: { userId: admin.id } });
  if (!credential?.enabled) return { error: "TOTP is no longer enabled." };
  const proof = await verifyProfileStepUp({ userId: admin.id, sessionId: session.id, sessionCreatedAt: session.createdAt,
    passwordHash: admin.passwordHash, action: "backup-codes-delete", method: "totp", code: String(formData.get("code") ?? ""), totpOnly: true });
  if (proof.error) return { error: proof.error };
  const deleted = await prisma.$transaction(async (tx) => {
    await lockUserSecurityState(tx, admin.id);
    const liveSession = await lockActiveSessionForUser(tx, session.id, admin.id);
    if (!liveSession || liveSession.createdAt < session.createdAt) return null;
    const liveCredential = await tx.totpCredential.findUnique({ where: { userId: admin.id } });
    if (!liveCredential?.enabled || liveCredential.id !== credential.id ||
        liveCredential.secretEncrypted !== credential.secretEncrypted ||
        (liveCredential.enabledAt?.getTime() ?? null) !== (credential.enabledAt?.getTime() ?? null)) return null;
    return tx.backupCode.deleteMany({ where: { userId: admin.id } });
  });
  if (!deleted) return { error: "Your session or authenticator changed. Sign in again before deleting backup codes." };
  if (deleted.count > 0) {
    await auditLog({
      userId: admin.id,
      action: AuditAction.BACKUP_CODES_DELETED,
      entityType: "BackupCode",
      details: { count: deleted.count }
    });
  }
  revalidatePath("/admin/profile");
  return { deleted: true };
}

export async function removePasskeyAction(_state: { error?: string; removed?: boolean } | null, formData: FormData): Promise<{ error?: string; removed?: boolean }> {
  try { validateCsrf(formData); } catch { return { error: "The form expired. Please refresh and try again." }; }
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const id = String(formData.get("id") ?? "");
  const session = await getCurrentSession();
  if (!session || session.userId !== admin.id) return { error: "Sign in again before removing a passkey." };
  if (!id || !(await prisma.passkey.findFirst({ where: { id, userId: admin.id }, select: { id: true } }))) {
    return { error: "This passkey is no longer registered." };
  }
  const credential = await prisma.totpCredential.findUnique({ where: { userId: admin.id } });
  const proof = await verifyProfileStepUp({ userId: admin.id, sessionId: session.id, sessionCreatedAt: session.createdAt,
    passwordHash: admin.passwordHash, action: "passkey-remove", resourceId: id,
    method: String(formData.get("method") ?? ""), code: String(formData.get("code") ?? ""),
    password: String(formData.get("password") ?? ""), proofCookie: (await cookies()).get(PROFILE_VERIFICATION_COOKIE)?.value });
  if (proof.error) return { error: proof.error };
  const deleted = await prisma.$transaction(async (tx) => {
    await lockUserSecurityState(tx, admin.id);
    const liveSession = await lockActiveSessionForUser(tx, session.id, admin.id);
    if (!liveSession || liveSession.createdAt < session.createdAt) return null;
    const liveCredential = await tx.totpCredential.findUnique({ where: { userId: admin.id } });
    if (Boolean(liveCredential?.enabled) !== Boolean(credential?.enabled) ||
        (credential?.enabled && (liveCredential?.id !== credential.id ||
          liveCredential.secretEncrypted !== credential.secretEncrypted ||
          (liveCredential.enabledAt?.getTime() ?? null) !== (credential.enabledAt?.getTime() ?? null)))) return null;
    return tx.passkey.deleteMany({ where: { id, userId: admin.id } });
  });
  if (!deleted) return { error: "Your session or authenticator changed. Sign in again before removing a passkey." };
  if (!deleted.count) return { error: "That passkey is no longer registered." };
  await auditLog({ userId: admin.id, action: AuditAction.PASSKEY_REMOVED, entityType: "Passkey", entityId: id });
  if (proof.usedProvider) (await cookies()).set(PROFILE_VERIFICATION_COOKIE, "", { ...profileVerificationCookieOptions(), maxAge: 0 });
  revalidatePath("/admin/profile");
  return { removed: true };
}

export async function logoutOtherSessionsAction(formData: FormData) {
  validateCsrf(formData);
  const currentSession = await getCurrentSession();
  if (!currentSession) throw new Error("Unauthorized");

  const deleted = await prisma.$transaction(async (tx) => {
    await lockUserSecurityState(tx, currentSession.userId);
    const liveSession = await lockActiveSessionForUser(tx, currentSession.id, currentSession.userId);
    if (!liveSession) return null;
    return tx.session.deleteMany({
      where: {
        userId: currentSession.userId,
        id: { not: currentSession.id }
      }
    });
  });
  if (!deleted) throw new Error("Unauthorized");

  if (deleted.count > 0) {
    await auditLog({
      userId: currentSession.userId,
      action: AuditAction.LOGOUT,
      entityType: "Session",
      details: { count: deleted.count, scope: "other_sessions" }
    });
  }
  revalidatePath("/admin/profile");
}

export async function revokeSessionAction(formData: FormData) {
  validateCsrf(formData);
  const currentSession = await getCurrentSession();
  if (!currentSession) throw new Error("Unauthorized");
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId || sessionId === currentSession.id) return;

  const deleted = await prisma.session.deleteMany({
    where: {
      id: sessionId,
      userId: currentSession.userId
    }
  });

  if (deleted.count > 0) {
    await auditLog({
      userId: currentSession.userId,
      action: AuditAction.LOGOUT,
      entityType: "Session",
      entityId: sessionId,
      details: { scope: "selected_session" }
    });
  }
  revalidatePath("/admin/profile");
}
