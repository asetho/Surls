import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "@/lib/crypto";

const auth = vi.hoisted(() => ({ requireAdmin: vi.fn(), getCurrentSession: vi.fn() }));
const jar = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  totpCredential: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  backupCode: { deleteMany: vi.fn(), createMany: vi.fn() },
  session: { deleteMany: vi.fn() }
}));
const prisma = vi.hoisted(() => ({
  totpCredential: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn()
}));
const totp = vi.hoisted(() => ({ verifyTotpCode: vi.fn(), createTotpSecret: vi.fn() }));
const backup = vi.hoisted(() => ({ generateBackupCodes: vi.fn(), hashBackupCode: vi.fn() }));
const proof = vi.hoisted(() => ({
  TOTP_ENROLLMENT_COOKIE: "surls_totp_enrollment",
  TOTP_SETUP_COOKIE: "surls_totp_setup",
  totpEnrollmentCookieOptions: vi.fn(() => ({ path: "/admin/profile" })),
  totpSetupCookieOptions: vi.fn(() => ({ path: "/admin/profile" })),
  createTotpEnrollment: vi.fn(), decodeTotpEnrollment: vi.fn(),
  encodeTotpSetup: vi.fn(), decodeTotpSetup: vi.fn()
}));
const rate = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const audit = vi.hoisted(() => ({ auditLog: vi.fn() }));
const password = vi.hoisted(() => ({ verifyPassword: vi.fn() }));
const setupProof = vi.hoisted(() => ({
  TOTP_SETUP_PROOF_COOKIE: "surls_totp_setup_proof",
  decodeTotpSetupProof: vi.fn(),
  totpSetupProofCookieOptions: vi.fn(() => ({ path: "/admin/profile" })),
  totpSetupProofUseKey: vi.fn(() => "profile:totp-setup:proof")
}));
const setupEmail = vi.hoisted(() => ({
  TOTP_SETUP_EMAIL_CODE_COOKIE: "surls_totp_setup_email_code",
  createTotpSetupEmailCode: vi.fn(), decodeTotpSetupEmailCode: vi.fn(), verifyTotpSetupEmailCode: vi.fn(),
  totpSetupEmailCodeCookieOptions: vi.fn(() => ({ path: "/admin/profile" }))
}));
const profileEmail = vi.hoisted(() => ({ profileEmailAvailable: vi.fn(), sendTotpSetupEmailCode: vi.fn() }));

vi.mock("@/lib/auth", () => auth);
vi.mock("next/headers", () => ({ cookies: async () => jar }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/totp", () => totp);
vi.mock("@/lib/backup-codes", () => backup);
vi.mock("@/lib/totp-enrollment", () => proof);
vi.mock("@/lib/rate-limit", () => rate);
vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/csrf", () => ({ validateCsrf: vi.fn() }));
vi.mock("@/lib/settings", () => ({ getSiteName: vi.fn() }));
vi.mock("@/lib/profile-email", () => profileEmail);
vi.mock("@/lib/profile-email-code", () => ({}));
vi.mock("@/lib/profile-verification", () => ({}));
vi.mock("@/lib/password", () => password);
vi.mock("@/lib/totp-setup-proof", () => setupProof);
vi.mock("@/lib/totp-setup-email-code", () => setupEmail);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

function form(step: string, values: Record<string, string> = {}) {
  const data = new FormData();
  data.set("csrf", "valid");
  data.set("step", step);
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

describe("TOTP enrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAdmin.mockResolvedValue({ id: "user_1", email: "user@example.com", passwordHash: "hash" });
    auth.getCurrentSession.mockResolvedValue({ id: "session_1", userId: "user_1" });
    prisma.totpCredential.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx));
    rate.checkRateLimit.mockResolvedValue({ allowed: true });
    totp.verifyTotpCode.mockResolvedValue(true);
    password.verifyPassword.mockResolvedValue(true);
    profileEmail.profileEmailAvailable.mockResolvedValue(true);
    profileEmail.sendTotpSetupEmailCode.mockResolvedValue(undefined);
    setupEmail.createTotpSetupEmailCode.mockReturnValue({ code: "123456", cookie: "signed-email-code" });
    setupEmail.verifyTotpSetupEmailCode.mockReturnValue(true);
    backup.generateBackupCodes.mockReturnValue(Array.from({ length: 10 }, (_, index) => `ABCDE-0000${index}`));
    backup.hashBackupCode.mockImplementation(async (code: string) => `hashed-${code}`);
    proof.createTotpEnrollment.mockReturnValue({ cookie: "encrypted-proof", nonce: "nonce" });
    proof.encodeTotpSetup.mockReturnValue("encrypted-setup");
    proof.decodeTotpEnrollment.mockReturnValue(null);
    proof.decodeTotpSetup.mockReturnValue({ userId: "user_1", sessionId: "session_1", secretEncrypted: "encrypted" });
    jar.get.mockImplementation((name: string) => name === "surls_totp_setup" ? { value: "encrypted-setup" } : undefined);
    tx.totpCredential.findUnique.mockResolvedValue(null);
    tx.$queryRaw.mockImplementation(async (parts: TemplateStringsArray) =>
      String(parts[0]).includes('"Session"')
        ? [{ userId: "user_1", createdAt: new Date("2026-09-26T12:00:00Z"), expiresAt: new Date(Date.now() + 60_000) }]
        : [{ id: "user_1" }]);
    tx.totpCredential.create.mockResolvedValue({});
    tx.totpCredential.updateMany.mockResolvedValue({ count: 1 });
    totp.createTotpSecret.mockReturnValue({ encryptedSecret: "rotated-encrypted" });
  });

  it("keeps a new pending seed in the initiating session without writing a credential", async () => {
    const { startTotpAction } = await import("@/app/admin/profile/actions");
    expect(await startTotpAction(null, form("start", { method: "password", password: "correct" }))).toEqual({ started: true });
    expect(proof.encodeTotpSetup).toHaveBeenCalledWith("user_1", "session_1", "rotated-encrypted");
    expect(jar.set).toHaveBeenCalledWith("surls_totp_setup", "encrypted-setup", { path: "/admin/profile" });
    expect(prisma.totpCredential.create).not.toHaveBeenCalled();
    expect(prisma.totpCredential.updateMany).not.toHaveBeenCalled();
  });

  it("requires fresh account proof before issuing a TOTP seed", async () => {
    const { startTotpAction } = await import("@/app/admin/profile/actions");
    expect(await startTotpAction(null, form("start"))).toMatchObject({ error: expect.stringContaining("Choose") });
    password.verifyPassword.mockResolvedValue(false);
    expect(await startTotpAction(null, form("start", { method: "password", password: "wrong" })))
      .toMatchObject({ error: expect.stringContaining("current Surls password") });
    expect(jar.set).not.toHaveBeenCalledWith("surls_totp_setup", expect.anything(), expect.anything());
  });

  it("consumes a matching linked-provider setup proof once before creating a seed", async () => {
    const { startTotpAction } = await import("@/app/admin/profile/actions");
    jar.get.mockImplementation((name: string) => name === "surls_totp_setup_proof" ? { value: "signed-proof" } : undefined);
    setupProof.decodeTotpSetupProof.mockReturnValue({ userId: "user_1", sessionId: "session_1", nonce: "proof-nonce" });
    expect(await startTotpAction(null, form("start", { method: "provider" }))).toEqual({ started: true });
    expect(rate.checkRateLimit).toHaveBeenCalledWith("profile:totp-setup:proof", 1, 300_000);
    rate.checkRateLimit.mockResolvedValue({ allowed: false });
    expect(await startTotpAction(null, form("start", { method: "provider" })))
      .toMatchObject({ error: expect.stringContaining("already used") });
    expect(proof.encodeTotpSetup).toHaveBeenCalledTimes(1);
  });

  it("sends a code to the current email and binds its use to that email and session", async () => {
    const { sendTotpSetupEmailCodeAction, startTotpAction } = await import("@/app/admin/profile/actions");
    expect(await sendTotpSetupEmailCodeAction(null, form("send"))).toMatchObject({ sent: true });
    expect(profileEmail.sendTotpSetupEmailCode).toHaveBeenCalledWith("user@example.com", "123456");
    expect(jar.set).toHaveBeenCalledWith("surls_totp_setup_email_code", "signed-email-code", { path: "/admin/profile" });

    jar.get.mockImplementation((name: string) => name === "surls_totp_setup_email_code" ? { value: "signed-email-code" } : undefined);
    setupEmail.decodeTotpSetupEmailCode.mockReturnValue({ userId: "user_1", sessionId: "other_session", currentEmail: "user@example.com", nonce: "nonce" });
    expect(await startTotpAction(null, form("start", { method: "email", code: "123456" })))
      .toMatchObject({ error: expect.stringContaining("Invalid") });
    setupEmail.decodeTotpSetupEmailCode.mockReturnValue({ userId: "user_1", sessionId: "session_1", currentEmail: "previous@example.com", nonce: "nonce" });
    expect(await startTotpAction(null, form("start", { method: "email", code: "123456" })))
      .toMatchObject({ error: expect.stringContaining("Invalid") });
    setupEmail.decodeTotpSetupEmailCode.mockReturnValue({ userId: "user_1", sessionId: "session_1", currentEmail: "user@example.com", nonce: "nonce" });
    expect(await startTotpAction(null, form("start", { method: "email", code: "123456" }))).toEqual({ started: true });
    expect(rate.checkRateLimit).toHaveBeenCalledWith(expect.stringContaining("profile:totp-setup-email-code:"), 1, 600_000);
    rate.checkRateLimit.mockResolvedValueOnce({ allowed: true }).mockResolvedValueOnce({ allowed: false });
    expect(await startTotpAction(null, form("start", { method: "email", code: "123456" })))
      .toMatchObject({ error: expect.stringContaining("already used") });
    expect(proof.encodeTotpSetup).toHaveBeenCalledTimes(1);
  });

  it("verifies TOTP and shows generated codes without enabling it", async () => {
    const { enrollTotpAction } = await import("@/app/admin/profile/actions");
    const result = await enrollTotpAction(null, form("verify", { code: "123456" }));
    expect(result.codes).toHaveLength(10);
    expect(result.confirmationNonce).toBe("nonce");
    expect(jar.set).toHaveBeenCalledWith("surls_totp_enrollment", "encrypted-proof", { path: "/admin/profile" });
    expect(proof.createTotpEnrollment).toHaveBeenCalledWith("user_1", "session_1", "encrypted", result.codes);
    expect(tx.totpCredential.updateMany).not.toHaveBeenCalled();
  });

  it("does not reveal setup proof or cancel enrollment from another session", async () => {
    const { cancelTotpSetupAction, enrollTotpAction } = await import("@/app/admin/profile/actions");
    auth.getCurrentSession.mockResolvedValue({ id: "session_other", userId: "user_1" });
    expect(await enrollTotpAction(null, form("verify", { code: "123456" }))).toMatchObject({ error: expect.stringContaining("Start") });
    await cancelTotpSetupAction(form("cancel"));
    expect(totp.verifyTotpCode).not.toHaveBeenCalled();
    expect(jar.set).not.toHaveBeenCalled();
    expect(prisma.totpCredential.deleteMany).not.toHaveBeenCalled();
  });

  it("requires saved-code confirmation and a matching pending proof", async () => {
    const { enrollTotpAction } = await import("@/app/admin/profile/actions");
    expect(await enrollTotpAction(null, form("confirm"))).toMatchObject({ error: expect.stringContaining("Confirm") });
    expect(await enrollTotpAction(null, form("confirm", { codesSaved: "yes" }))).toMatchObject({ error: expect.stringContaining("expired") });
    proof.decodeTotpEnrollment.mockReturnValue({ userId: "user_1", sessionId: "other_session" });
    expect(await enrollTotpAction(null, form("confirm", { codesSaved: "yes" }))).toMatchObject({ error: expect.stringContaining("expired") });
    expect(tx.totpCredential.updateMany).not.toHaveBeenCalled();
  });

  it("rejects codes displayed in a stale tab after another tab replaces the confirmation cookie", async () => {
    const { enrollTotpAction } = await import("@/app/admin/profile/actions");
    proof.decodeTotpEnrollment.mockReturnValue({
      userId: "user_1", sessionId: "session_1", nonce: "tab-b-nonce",
      secretFingerprint: hashToken("encrypted"),
      codes: Array.from({ length: 10 }, (_, index) => `BCDEF-0000${index}`)
    });

    expect(await enrollTotpAction(null, form("confirm", { codesSaved: "yes", confirmationNonce: "tab-a-nonce" })))
      .toMatchObject({ error: expect.stringContaining("expired") });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.backupCode.createMany).not.toHaveBeenCalled();
  });

  it("enables TOTP atomically with hashed codes and revokes older sessions", async () => {
    const { enrollTotpAction } = await import("@/app/admin/profile/actions");
    proof.decodeTotpEnrollment.mockReturnValue({
      userId: "user_1", sessionId: "session_1", nonce: "nonce",
      secretFingerprint: hashToken("encrypted"),
      codes: Array.from({ length: 10 }, (_, index) => `ABCDE-0000${index}`)
    });
    expect(await enrollTotpAction(null, form("confirm", { codesSaved: "yes", confirmationNonce: "nonce" }))).toEqual({ complete: true });
    expect(tx.totpCredential.create).toHaveBeenCalledWith({
      data: { userId: "user_1", secretEncrypted: "encrypted", enabled: true, enabledAt: expect.any(Date) }
    });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.totpCredential.findUnique.mock.invocationCallOrder[0]);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(String(tx.$queryRaw.mock.calls[1]?.[0]?.join(""))).toContain('FROM "Session"');
    expect(String(tx.$queryRaw.mock.calls[1]?.[0]?.join(""))).toContain("FOR UPDATE");
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(tx.totpCredential.findUnique.mock.invocationCallOrder[0]);
    expect(tx.backupCode.createMany.mock.calls[0][0].data).toHaveLength(10);
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_1", id: { not: "session_1" } } });
    expect(jar.set).toHaveBeenCalledWith("surls_totp_enrollment", "", { path: "/admin/profile", maxAge: 0 });
    expect(jar.set).toHaveBeenCalledWith("surls_totp_setup", "", { path: "/admin/profile", maxAge: 0 });
  });

  it("does not confirm enrollment when the initiating session is revoked during code hashing", async () => {
    const { enrollTotpAction } = await import("@/app/admin/profile/actions");
    proof.decodeTotpEnrollment.mockReturnValue({
      userId: "user_1", sessionId: "session_1", nonce: "nonce",
      secretFingerprint: hashToken("encrypted"),
      codes: Array.from({ length: 10 }, (_, index) => `ABCDE-0000${index}`)
    });
    let hashingStarted = () => {};
    const hashing = new Promise<void>((resolve) => { hashingStarted = resolve; });
    let releaseHash = () => {};
    const hashBarrier = new Promise<void>((resolve) => { releaseHash = resolve; });
    backup.hashBackupCode.mockImplementation(async (code: string) => {
      hashingStarted();
      await hashBarrier;
      return `hashed-${code}`;
    });
    const confirmation = enrollTotpAction(null, form("confirm", { codesSaved: "yes", confirmationNonce: "nonce" }));
    await hashing;
    tx.$queryRaw.mockImplementation(async (parts: TemplateStringsArray) =>
      String(parts[0]).includes('"Session"') ? [] : [{ id: "user_1" }]);
    releaseHash();

    expect(await confirmation).toMatchObject({ error: expect.stringContaining("Sign in again") });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.totpCredential.create).not.toHaveBeenCalled();
    expect(tx.totpCredential.updateMany).not.toHaveBeenCalled();
    expect(tx.backupCode.deleteMany).not.toHaveBeenCalled();
    expect(tx.session.deleteMany).not.toHaveBeenCalled();
    expect(audit.auditLog).not.toHaveBeenCalled();
  });

  it("rejects a proof verified for a seed replaced in the same session", async () => {
    const { startTotpAction, enrollTotpAction } = await import("@/app/admin/profile/actions");
    const codes = Array.from({ length: 10 }, (_, index) => `ABCDE-0000${index}`);
    proof.decodeTotpEnrollment.mockReturnValue({
      userId: "user_1", sessionId: "session_1",
      secretFingerprint: hashToken("encrypted"), nonce: "nonce", codes
    });
    expect(await enrollTotpAction(null, form("verify", { code: "123456" }))).toMatchObject({ codes });
    await startTotpAction(null, form("start", { method: "password", password: "correct" }));
    expect(jar.set).toHaveBeenCalledWith("surls_totp_enrollment", "", { path: "/admin/profile", maxAge: 0 });
    proof.decodeTotpSetup.mockReturnValue({ userId: "user_1", sessionId: "session_1", secretEncrypted: "rotated-encrypted" });
    expect(await enrollTotpAction(null, form("confirm", { codesSaved: "yes", confirmationNonce: "nonce" }))).toMatchObject({ error: expect.stringContaining("expired") });
    expect(tx.totpCredential.updateMany).not.toHaveBeenCalled();
    expect(tx.backupCode.createMany).not.toHaveBeenCalled();
  });

  it("replaces a legacy pending row but cannot overwrite an enabled credential", async () => {
    const { enrollTotpAction } = await import("@/app/admin/profile/actions");
    proof.decodeTotpEnrollment.mockReturnValue({
      userId: "user_1", sessionId: "session_1",
      secretFingerprint: hashToken("encrypted"), nonce: "nonce",
      codes: Array.from({ length: 10 }, (_, index) => `ABCDE-0000${index}`)
    });
    tx.totpCredential.findUnique.mockResolvedValue({ id: "legacy_credential", enabled: false });
    expect(await enrollTotpAction(null, form("confirm", { codesSaved: "yes", confirmationNonce: "nonce" }))).toEqual({ complete: true });
    expect(tx.totpCredential.updateMany).toHaveBeenCalledWith({
      where: { id: "legacy_credential", userId: "user_1", enabled: false },
      data: { secretEncrypted: "encrypted", enabled: true, enabledAt: expect.any(Date) }
    });

    vi.clearAllMocks();
    tx.totpCredential.findUnique.mockResolvedValue({ id: "credential_1", enabled: true });
    tx.totpCredential.updateMany.mockResolvedValue({ count: 0 });
    expect(await enrollTotpAction(null, form("confirm", { codesSaved: "yes", confirmationNonce: "nonce" }))).toMatchObject({ error: expect.stringContaining("changed") });
    expect(tx.backupCode.deleteMany).not.toHaveBeenCalled();
    expect(tx.backupCode.createMany).not.toHaveBeenCalled();
    expect(tx.session.deleteMany).not.toHaveBeenCalled();
  });
});
