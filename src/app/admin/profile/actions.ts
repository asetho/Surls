"use server";

import { AuditAction, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auditLog } from "@/lib/audit";
import { getCurrentSession, requireAdmin, requireSiteAdmin } from "@/lib/auth";
import { hashToken } from "@/lib/crypto";
import { generateBackupCodes, hashBackupCode } from "@/lib/backup-codes";
import { validateCsrf } from "@/lib/csrf";
import { normalizeMobileMenuSide } from "@/lib/mobile-menu";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { profileEmailAvailable, sendProfileEmailCode, sendTotpSetupEmailCode } from "@/lib/profile-email";
import { createProfileEmailCode, decodeProfileEmailCode, PROFILE_EMAIL_CODE_COOKIE, profileEmailCodeCookieOptions, verifyProfileEmailCode } from "@/lib/profile-email-code";
import { decodeProfileVerification, PROFILE_VERIFICATION_COOKIE, profileVerificationCookieOptions, profileVerificationUseKey } from "@/lib/profile-verification";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSiteName } from "@/lib/settings";
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
  if (emailChanged) {
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.userId !== user.id) return { error: "Sign in again before changing your email." };
    const jar = await cookies();
    const providerVerification = decodeProfileVerification(jar.get(PROFILE_VERIFICATION_COOKIE)?.value);
    const providerVerified = providerVerification?.userId === user.id && providerVerification.sessionId === currentSession.id &&
      providerVerification.pendingEmail === profile.email;
    const code = formData.get("resendCode") === "yes" ? "" : String(formData.get("verificationCode") ?? "").trim();

    if (providerVerified) {
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
      if (!(await verifyTotpCode(user.totpCredential.secretEncrypted, code))) return { error: "Invalid authenticator code.", verificationRequired: "totp" };
      const used = await checkRateLimit(`profile:totp-code:${user.id}:${hashToken(code.replace(/\s+/g, ""))}`, 1, 90 * 1000);
      if (!used.allowed) return { error: "That authenticator code was already used. Wait for the next code.", verificationRequired: "totp" };
    } else if (code) {
      const rate = await checkRateLimit(`profile:email-verification:${user.id}`, 5, 15 * 60 * 1000);
      if (!rate.allowed) return { error: "Too many verification attempts. Please wait and try again.", verificationRequired: "email" };
      const proof = decodeProfileEmailCode(jar.get(PROFILE_EMAIL_CODE_COOKIE)?.value);
      if (!proof || proof.userId !== user.id || proof.sessionId !== currentSession.id ||
          proof.currentEmail !== user.email || proof.pendingEmail !== profile.email || !verifyProfileEmailCode(proof, code)) {
        return { error: "Invalid or expired email verification code.", verificationRequired: "email" };
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
    await prisma.user.update({
      where: { id: user.id },
      data: profile
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) return { error: "A user with that email already exists." };
    throw error;
  }

  if (usedProviderVerification) (await cookies()).set(PROFILE_VERIFICATION_COOKIE, "", { ...profileVerificationCookieOptions(), maxAge: 0 });
  if (usedEmailCode) (await cookies()).set(PROFILE_EMAIL_CODE_COOKIE, "", { ...profileEmailCodeCookieOptions(), maxAge: 0 });

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
    const rate = await checkRateLimit(`profile:totp-setup-password:${admin.id}`, 5, 15 * 60 * 1000);
    if (!rate.allowed) return { error: "Too many password attempts. Please wait and try again." };
    const password = String(formData.get("password") ?? "");
    if (!password || !(await verifyPassword(admin.passwordHash, password))) return { error: "Enter your current Surls password." };
  } else if (method === "email") {
    const rate = await checkRateLimit(`profile:totp-setup-email-verify:${admin.id}`, 5, 15 * 60 * 1000);
    if (!rate.allowed) return { error: "Too many verification attempts. Please wait and try again." };
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
  if (!code || !(await verifyTotpCode(credential.secretEncrypted, code))) {
    return { error: "Enter a valid current authenticator code." };
  }
  const used = await checkRateLimit(`profile:totp-code:${admin.id}:${hashToken(code.replace(/\s+/g, ""))}`, 1, 90 * 1000);
  if (!used.allowed) return { error: "That authenticator code was already used. Wait for the next code." };
  const deleted = await prisma.$transaction(async (tx) => {
    await lockUserSecurityState(tx, admin.id);
    const liveSession = await lockActiveSessionForUser(tx, session.id, admin.id);
    if (!liveSession) return null;
    return tx.totpCredential.deleteMany({
      where: {
        id: credential.id, userId: admin.id, enabled: true,
        enabledAt: credential.enabledAt, secretEncrypted: credential.secretEncrypted
      }
    });
  });
  if (!deleted) return { error: "Sign in again before disabling TOTP." };
  if (!deleted.count) return { error: "TOTP is no longer enabled." };
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
  if (!/^[0-9]{6}$/.test(code) || !(await verifyTotpCode(credential.secretEncrypted, code))) {
    return { error: "Enter a valid current authenticator code." };
  }
  const used = await checkRateLimit(`profile:totp-code:${admin.id}:${hashToken(code)}`, 1, 90 * 1000);
  if (!used.allowed) return { error: "That authenticator code was already used. Wait for the next code." };
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
    await tx.backupCode.deleteMany({ where: { userId: admin.id } });
    await tx.backupCode.createMany({
      data: hashedCodes.map(({ codeHash }) => ({ userId: admin.id, codeHash, createdAt: generatedAt }))
    });
    return true;
  });
  if (!regenerated) return { error: "Your session or authenticator changed. Sign in again before regenerating backup codes." };
  await auditLog({ userId: admin.id, action: AuditAction.BACKUP_CODES_REGENERATED });
  revalidatePath("/admin/profile");
  return { codes, generatedAt: generatedAt.toISOString() };
}

export async function deleteBackupCodesAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireSiteAdmin();
  if (!admin) throw new Error("Unauthorized");
  const session = await getCurrentSession();
  if (!session || session.userId !== admin.id) throw new Error("Unauthorized");
  const deleted = await prisma.$transaction(async (tx) => {
    await lockUserSecurityState(tx, admin.id);
    const liveSession = await lockActiveSessionForUser(tx, session.id, admin.id);
    if (!liveSession) return null;
    return tx.backupCode.deleteMany({ where: { userId: admin.id } });
  });
  if (!deleted) return;
  if (deleted.count > 0) {
    await auditLog({
      userId: admin.id,
      action: AuditAction.BACKUP_CODES_DELETED,
      entityType: "BackupCode",
      details: { count: deleted.count }
    });
  }
  revalidatePath("/admin/profile");
}

export async function removePasskeyAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const id = String(formData.get("id") ?? "");
  const deleted = await prisma.passkey.deleteMany({ where: { id, userId: admin.id } });
  if (deleted.count > 0) {
    await auditLog({ userId: admin.id, action: AuditAction.PASSKEY_REMOVED, entityType: "Passkey", entityId: id });
  }
  revalidatePath("/admin/profile");
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
