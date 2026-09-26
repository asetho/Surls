import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getCurrentSession: vi.fn(), requireAdmin: vi.fn(), requireSiteAdmin: vi.fn() }));
const cookieJar = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
const tx = vi.hoisted(() => ({ $queryRaw: vi.fn(), totpCredential: { deleteMany: vi.fn() } }));
const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  user: { findFirst: vi.fn(), update: vi.fn() },
  totpCredential: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() }
}));
const rate = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const totp = vi.hoisted(() => ({ createTotpSecret: vi.fn(), verifyTotpCode: vi.fn() }));
const email = vi.hoisted(() => ({ profileEmailAvailable: vi.fn(), sendProfileEmailCode: vi.fn() }));
const emailCode = vi.hoisted(() => ({
  PROFILE_EMAIL_CODE_COOKIE: "surls_profile_email_code",
  createProfileEmailCode: vi.fn(), decodeProfileEmailCode: vi.fn(),
  profileEmailCodeCookieOptions: vi.fn(() => ({ path: "/admin/profile" })),
  verifyProfileEmailCode: vi.fn()
}));
const settings = vi.hoisted(() => ({ getSetting: vi.fn(), getSiteName: vi.fn() }));
const profileVerification = vi.hoisted(() => ({
  PROFILE_VERIFICATION_COOKIE: "surls_profile_verification",
  decodeProfileVerification: vi.fn(),
  profileVerificationCookieOptions: vi.fn(() => ({ path: "/admin/profile" })),
  profileVerificationUseKey: vi.fn(() => "profile:verification:proof")
}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const audit = vi.hoisted(() => ({ auditLog: vi.fn() }));

vi.mock("@/lib/auth", () => auth);
vi.mock("next/headers", () => ({ cookies: async () => cookieJar }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/rate-limit", () => rate);
vi.mock("@/lib/profile-email", () => email);
vi.mock("@/lib/profile-email-code", () => emailCode);
vi.mock("@/lib/totp", () => totp);
vi.mock("@/lib/settings", () => settings);
vi.mock("@/lib/profile-verification", () => profileVerification);
vi.mock("@/lib/csrf", () => ({ validateCsrf: vi.fn() }));
vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/backup-codes", () => ({ generateBackupCodes: vi.fn(), hashBackupCode: vi.fn() }));
vi.mock("next/cache", () => cache);
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));

function profileForm(email = "new@example.com") {
  const form = new FormData();
  form.set("csrf", "valid");
  form.set("email", email);
  form.set("name", "Test User");
  form.set("displayTimeZone", "UTC");
  form.set("mobileMenuSide", "right");
  return form;
}

function codeForm(code?: string) {
  const form = new FormData();
  form.set("csrf", "valid");
  if (code) form.set("code", code);
  return form;
}

describe("sensitive profile changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAdmin.mockResolvedValue({ id: "user_1", email: "old@example.com", passwordHash: "password-hash", totpCredential: null });
    auth.getCurrentSession.mockResolvedValue({ id: "session_1", userId: "user_1", createdAt: new Date("2026-09-25T12:00:00Z") });
    cookieJar.get.mockReturnValue(undefined);
    profileVerification.decodeProfileVerification.mockReturnValue(null);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.update.mockResolvedValue({});
    prisma.totpCredential.findUnique.mockResolvedValue({ id: "totp_1", enabled: true, enabledAt: new Date("2026-09-25T12:00:00Z"), secretEncrypted: "encrypted-secret" });
    prisma.$transaction.mockImplementation(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx));
    tx.$queryRaw.mockImplementation(async (parts: TemplateStringsArray) =>
      String(parts[0]).includes('"Session"')
        ? [{ userId: "user_1", createdAt: new Date("2026-09-25T12:00:00Z"), expiresAt: new Date(Date.now() + 60_000) }]
        : [{ id: "user_1" }]);
    tx.totpCredential.deleteMany.mockResolvedValue({ count: 1 });
    rate.checkRateLimit.mockResolvedValue({ allowed: true });
    settings.getSetting.mockResolvedValue(true);
    email.profileEmailAvailable.mockReturnValue(true);
    email.sendProfileEmailCode.mockResolvedValue(undefined);
    emailCode.createProfileEmailCode.mockReturnValue({ code: "123456", cookie: "signed-email-proof" });
    emailCode.decodeProfileEmailCode.mockReturnValue(null);
    emailCode.verifyProfileEmailCode.mockReturnValue(false);
    totp.verifyTotpCode.mockResolvedValue(false);
  });

  it("sends a code to the current email before changing an address without TOTP", async () => {
    const { updateProfileAction } = await import("@/app/admin/profile/actions");
    expect(await updateProfileAction(null, profileForm())).toEqual({
      message: "Verification code sent to old@example.com.", verificationRequired: "email"
    });
    expect(email.sendProfileEmailCode).toHaveBeenCalledWith("old@example.com", "123456");
    expect(cookieJar.set).toHaveBeenCalledWith("surls_profile_email_code", "signed-email-proof", { path: "/admin/profile" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid or mismatched email code and consumes a valid one", async () => {
    const { updateProfileAction } = await import("@/app/admin/profile/actions");
    const form = profileForm();
    form.set("verificationCode", "123456");
    cookieJar.get.mockImplementation((name: string) => name === "surls_profile_email_code" ? { value: "signed-email-proof" } : undefined);
    expect(await updateProfileAction(null, form)).toEqual({ error: "Invalid or expired email verification code.", verificationRequired: "email" });
    expect(prisma.user.update).not.toHaveBeenCalled();
    emailCode.decodeProfileEmailCode.mockReturnValue({ userId: "user_1", sessionId: "session_1", currentEmail: "old@example.com", pendingEmail: "other@example.com", nonce: "nonce" });
    emailCode.verifyProfileEmailCode.mockReturnValue(true);
    expect(await updateProfileAction(null, form)).toMatchObject({ error: "Invalid or expired email verification code." });
    emailCode.decodeProfileEmailCode.mockReturnValue({ userId: "user_1", sessionId: "session_1", currentEmail: "old@example.com", pendingEmail: "new@example.com", nonce: "nonce" });
    expect(await updateProfileAction(null, form)).toEqual({ message: "Profile updated." });
    expect(cookieJar.set).toHaveBeenCalledWith("surls_profile_email_code", "", { path: "/admin/profile", maxAge: 0 });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: "new@example.com" }) }));
  });

  it("does not change the email when SMTP is unavailable and no other proof is supplied", async () => {
    email.profileEmailAvailable.mockReturnValue(false);
    const { updateProfileAction } = await import("@/app/admin/profile/actions");
    expect(await updateProfileAction(null, profileForm())).toMatchObject({
      error: expect.stringContaining("SMTP"), verificationRequired: "email"
    });
    expect(email.sendProfileEmailCode).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("accepts a current TOTP code only once for an email change", async () => {
    auth.requireAdmin.mockResolvedValue({ id: "user_1", email: "old@example.com", passwordHash: "password-hash",
      totpCredential: { enabled: true, secretEncrypted: "encrypted-secret", enabledAt: new Date("2026-09-24T12:00:00Z") } });
    const { updateProfileAction } = await import("@/app/admin/profile/actions");
    const form = profileForm();
    expect(await updateProfileAction(null, form)).toEqual({ verificationRequired: "totp" });
    expect(prisma.user.update).not.toHaveBeenCalled();
    form.set("verificationCode", "123456");
    expect(await updateProfileAction(null, form)).toEqual({ error: "Invalid authenticator code.", verificationRequired: "totp" });
    expect(prisma.user.update).not.toHaveBeenCalled();
    totp.verifyTotpCode.mockResolvedValue(true);
    expect(await updateProfileAction(null, form)).toEqual({ message: "Profile updated." });
    expect(rate.checkRateLimit).toHaveBeenCalledWith(expect.stringContaining("profile:totp-code:user_1:"), 1, 90_000);
  });

  it("does not trust a TOTP factor enrolled after this session began", async () => {
    auth.requireAdmin.mockResolvedValue({ id: "user_1", email: "old@example.com", passwordHash: "password-hash",
      totpCredential: { enabled: true, secretEncrypted: "encrypted-secret", enabledAt: new Date("2026-09-25T12:01:00Z") } });
    totp.verifyTotpCode.mockResolvedValue(true);
    const { updateProfileAction } = await import("@/app/admin/profile/actions");
    const form = profileForm();
    form.set("verificationCode", "123456");
    expect(await updateProfileAction(null, form)).toEqual({ error: "Sign in again before using a newly enabled authenticator to change your email.", verificationRequired: "totp" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("requires a provider proof bound to this session and consumes it", async () => {
    const { updateProfileAction } = await import("@/app/admin/profile/actions");
    cookieJar.get.mockReturnValue({ value: "signed-proof" });
    profileVerification.decodeProfileVerification.mockReturnValue({ userId: "user_1", sessionId: "other_session", nonce: "nonce" });
    expect(await updateProfileAction(null, profileForm())).toMatchObject({ verificationRequired: "email" });
    expect(prisma.user.update).not.toHaveBeenCalled();
    profileVerification.decodeProfileVerification.mockReturnValue({ userId: "user_1", sessionId: "session_1", pendingEmail: "other@example.com", nonce: "nonce" });
    expect(await updateProfileAction(null, profileForm())).toMatchObject({ verificationRequired: "email" });
    expect(prisma.user.update).not.toHaveBeenCalled();
    profileVerification.decodeProfileVerification.mockReturnValue({ userId: "user_1", sessionId: "session_1", pendingEmail: "new@example.com", nonce: "nonce" });
    expect(await updateProfileAction(null, profileForm())).toEqual({ message: "Profile updated." });
    expect(rate.checkRateLimit).toHaveBeenCalledWith("profile:verification:proof", 1, 300_000);
    expect(cookieJar.set).toHaveBeenCalledWith("surls_profile_verification", "", { path: "/admin/profile", maxAge: 0 });
  });

  it("requires a current TOTP code before disabling TOTP", async () => {
    const { disableTotpAction } = await import("@/app/admin/profile/actions");
    expect(await disableTotpAction(null, codeForm())).toEqual({ error: "Enter a valid current authenticator code." });
    expect(await disableTotpAction(null, codeForm("wrong"))).toEqual({ error: "Enter a valid current authenticator code." });
    expect(tx.totpCredential.deleteMany).not.toHaveBeenCalled();
    totp.verifyTotpCode.mockResolvedValue(true);
    expect(await disableTotpAction(null, codeForm("123456"))).toEqual({ message: "TOTP disabled." });
    expect(tx.totpCredential.deleteMany).toHaveBeenCalledWith({ where: {
      id: "totp_1", userId: "user_1", enabled: true,
      enabledAt: new Date("2026-09-25T12:00:00Z"), secretEncrypted: "encrypted-secret"
    } });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.totpCredential.deleteMany.mock.invocationCallOrder[0]);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(String(tx.$queryRaw.mock.calls[1]?.[0]?.join(""))).toContain('FROM "Session"');
    expect(String(tx.$queryRaw.mock.calls[1]?.[0]?.join(""))).toContain("FOR UPDATE");
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(tx.totpCredential.deleteMany.mock.invocationCallOrder[0]);
    expect(rate.checkRateLimit).toHaveBeenCalledWith(expect.stringContaining("profile:totp-code:user_1:"), 1, 90_000);
  });

  it("does not disable TOTP when the initiating session is revoked during code verification", async () => {
    const { disableTotpAction } = await import("@/app/admin/profile/actions");
    let verifyingStarted = () => {};
    const verifying = new Promise<void>((resolve) => { verifyingStarted = resolve; });
    let releaseVerification = () => {};
    const verificationBarrier = new Promise<void>((resolve) => { releaseVerification = resolve; });
    totp.verifyTotpCode.mockImplementation(async () => {
      verifyingStarted();
      await verificationBarrier;
      return true;
    });
    const disabling = disableTotpAction(null, codeForm("123456"));
    await verifying;
    tx.$queryRaw.mockImplementation(async (parts: TemplateStringsArray) =>
      String(parts[0]).includes('"Session"') ? [] : [{ id: "user_1" }]);
    releaseVerification();

    expect(await disabling).toEqual({ error: "Sign in again before disabling TOTP." });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.totpCredential.deleteMany).not.toHaveBeenCalled();
    expect(audit.auditLog).not.toHaveBeenCalled();
  });

  it("holds the session row lock through TOTP disable before a concurrent revocation completes", async () => {
    const { disableTotpAction } = await import("@/app/admin/profile/actions");
    const events: string[] = [];
    let signalSessionLock = () => {};
    const sessionLocked = new Promise<void>((resolve) => { signalSessionLock = resolve; });
    let signalDeleting = () => {};
    const deleting = new Promise<void>((resolve) => { signalDeleting = resolve; });
    let releaseDelete = () => {};
    const deleteBarrier = new Promise<void>((resolve) => { releaseDelete = resolve; });
    let signalCommit = () => {};
    const committed = new Promise<void>((resolve) => { signalCommit = resolve; });
    tx.$queryRaw.mockImplementation(async (parts: TemplateStringsArray) => {
      const sql = parts.join("");
      if (sql.includes('FROM "Session"')) {
        expect(sql).toContain("FOR UPDATE");
        events.push("session-lock");
        signalSessionLock();
        return [{ userId: "user_1", createdAt: new Date("2026-09-25T12:00:00Z"), expiresAt: new Date(Date.now() + 60_000) }];
      }
      events.push("user-lock");
      return [{ id: "user_1" }];
    });
    tx.totpCredential.deleteMany.mockImplementation(async () => {
      events.push("factor-delete");
      signalDeleting();
      await deleteBarrier;
      return { count: 1 };
    });
    prisma.$transaction.mockImplementation(async (callback: (value: typeof tx) => Promise<unknown>) => {
      const result = await callback(tx);
      events.push("commit");
      signalCommit();
      return result;
    });
    totp.verifyTotpCode.mockResolvedValue(true);
    const disabling = disableTotpAction(null, codeForm("123456"));
    await sessionLocked;
    await deleting;
    let revoked = false;
    const revocation = committed.then(() => { revoked = true; events.push("session-revoke"); });
    expect(revoked).toBe(false);
    releaseDelete();
    expect(await disabling).toEqual({ message: "TOTP disabled." });
    await revocation;
    expect(events).toEqual(["user-lock", "session-lock", "factor-delete", "commit", "session-revoke"]);
  });

  it("cannot restart setup over an enabled TOTP credential", async () => {
    const { startTotpAction } = await import("@/app/admin/profile/actions");
    await startTotpAction(null, codeForm());
    expect(prisma.totpCredential.create).not.toHaveBeenCalled();
    expect(prisma.totpCredential.updateMany).not.toHaveBeenCalled();
  });
});
