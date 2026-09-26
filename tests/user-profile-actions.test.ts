import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  requireAdmin: vi.fn(),
  requireSiteAdmin: vi.fn()
}));

const csrf = vi.hoisted(() => ({
  validateCsrf: vi.fn()
}));

const nextCache = vi.hoisted(() => ({
  revalidatePath: vi.fn()
}));

const navigation = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  })
}));

const rateLimit = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const audit = vi.hoisted(() => ({ auditLog: vi.fn() }));
const backupTx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  backupCode: { deleteMany: vi.fn(), createMany: vi.fn() },
  session: { deleteMany: vi.fn() },
  totpCredential: { findUnique: vi.fn(), deleteMany: vi.fn() }
}));

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  totpCredential: { findUnique: vi.fn() },
  backupCode: {
    create: vi.fn(),
    deleteMany: vi.fn()
  },
  session: {
    deleteMany: vi.fn()
  },
  user: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  }
}));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/csrf", () => csrf);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/rate-limit", () => rateLimit);
vi.mock("next/cache", () => nextCache);
vi.mock("next/navigation", () => navigation);
vi.mock("@/lib/audit", () => audit);
const backupCodes = vi.hoisted(() => ({
  generateBackupCodes: vi.fn<() => string[]>(() => []),
  hashBackupCode: vi.fn<(code: string) => Promise<string>>()
}));

vi.mock("@/lib/backup-codes", () => backupCodes);
vi.mock("@/lib/settings", () => ({ getSiteName: vi.fn() }));
const totp = vi.hoisted(() => ({ createTotpSecret: vi.fn(), verifyTotpCode: vi.fn() }));
vi.mock("@/lib/totp", () => totp);
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn() }));

function profileForm(
  fields: {
    displayTimeZone?: string;
    email?: string;
    id?: string;
    mobileMenuSide?: string;
    name?: string;
    role?: string;
  } = {}
) {
  const formData = new FormData();
  formData.set("csrf", "csrf-token");
  if (fields.id) formData.set("id", fields.id);
  formData.set("displayTimeZone", fields.displayTimeZone ?? "America/Los_Angeles");
  formData.set("email", fields.email ?? "  USER@Example.COM  ");
  formData.set("mobileMenuSide", fields.mobileMenuSide ?? "left");
  formData.set("name", fields.name ?? "  Test User  ");
  if (fields.role) formData.set("role", fields.role);
  return formData;
}

describe("profile identity actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAdmin.mockResolvedValue({ id: "user_1", role: "USER", email: "user@example.com" });
    auth.getCurrentSession.mockResolvedValue({ id: "session_current", userId: "user_1", createdAt: new Date("2026-09-26T12:00:00Z") });
    auth.requireSiteAdmin.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
    backupCodes.generateBackupCodes.mockReturnValue([]);
    backupCodes.hashBackupCode.mockResolvedValue("hashed-backup-code");
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true });
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof backupTx) => Promise<unknown>) => callback(backupTx));
    backupTx.$queryRaw.mockImplementation(async (parts: TemplateStringsArray) =>
      String(parts[0]).includes('"Session"')
        ? [{ userId: "user_1", createdAt: new Date("2026-09-26T12:00:00Z"), expiresAt: new Date(Date.now() + 60_000) }]
        : [{ id: "user_1" }]);
    backupTx.backupCode.deleteMany.mockResolvedValue({ count: 0 });
    backupTx.backupCode.createMany.mockResolvedValue({ count: 2 });
    backupTx.session.deleteMany.mockResolvedValue({ count: 0 });
    backupTx.totpCredential.findUnique.mockResolvedValue({ id: "totp_1", enabled: true, secretEncrypted: "encrypted", enabledAt: new Date("2026-09-25T12:00:00Z") });
    backupTx.totpCredential.deleteMany.mockResolvedValue({ count: 1 });
    prisma.backupCode.create.mockResolvedValue({});
    prisma.backupCode.deleteMany.mockResolvedValue({ count: 0 });
    prisma.session.deleteMany.mockResolvedValue({ count: 0 });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ id: "user_1", role: "USER" });
    prisma.user.count.mockResolvedValue(2);
    prisma.user.update.mockResolvedValue({});
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.totpCredential.findUnique.mockResolvedValue({ id: "totp_1", enabled: true, secretEncrypted: "encrypted", enabledAt: new Date("2026-09-25T12:00:00Z") });
    totp.verifyTotpCode.mockResolvedValue(true);
  });

  it("lets signed-in users update their own profile when email is unchanged", async () => {
    const { updateProfileAction } = await import("@/app/admin/profile/actions");

    await expect(updateProfileAction(null, profileForm())).resolves.toEqual({ message: "Profile updated." });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: {
        displayTimeZone: "America/Los_Angeles",
        email: "user@example.com",
        mobileMenuSide: "left",
        name: "Test User"
      }
    });
    expect(nextCache.revalidatePath).toHaveBeenCalledWith("/admin/profile");
  });

  it("lets signed-in users choose the site default timezone", async () => {
    const { updateProfileAction } = await import("@/app/admin/profile/actions");

    await expect(updateProfileAction(null, profileForm({ displayTimeZone: "" }))).resolves.toEqual({
      message: "Profile updated."
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: {
        displayTimeZone: null,
        email: "user@example.com",
        mobileMenuSide: "left",
        name: "Test User"
      }
    });
  });

  it("falls back to the right-side mobile menu when profile input is invalid", async () => {
    const { updateProfileAction } = await import("@/app/admin/profile/actions");

    await expect(updateProfileAction(null, profileForm({ mobileMenuSide: "top" }))).resolves.toEqual({
      message: "Profile updated."
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: {
        displayTimeZone: "America/Los_Angeles",
        email: "user@example.com",
        mobileMenuSide: "right",
        name: "Test User"
      }
    });
  });

  it("rejects duplicate emails for self-updates", async () => {
    const { updateProfileAction } = await import("@/app/admin/profile/actions");
    prisma.user.findFirst.mockResolvedValue({ id: "other_user" });

    await expect(updateProfileAction(null, profileForm())).resolves.toEqual({
      error: "A user with that email already exists."
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects temporary passwords that cannot be used at sign-in", async () => {
    const { createUserAction } = await import("@/app/admin/users/actions");
    const formData = profileForm({ email: "new@example.com" });
    formData.set("password", "x".repeat(4097));

    await expect(createUserAction(null, formData)).resolves.toEqual({
      error: "Temporary passwords must be 4,096 characters or fewer."
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("lets admins update another user's name and email", async () => {
    const { updateUserIdentityAction } = await import("@/app/admin/users/actions");

    await expect(updateUserIdentityAction(null, profileForm({ id: "user_2" }))).resolves.toEqual({
      message: "User updated."
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_2" },
      data: {
        displayTimeZone: "America/Los_Angeles",
        email: "user@example.com",
        name: "Test User"
      }
    });
    expect(nextCache.revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("rejects duplicate emails for admin user updates", async () => {
    const { updateUserIdentityAction } = await import("@/app/admin/users/actions");
    prisma.user.findFirst.mockResolvedValue({ id: "other_user" });

    await expect(updateUserIdentityAction(null, profileForm({ id: "user_2" }))).resolves.toEqual({
      error: "A user with that email already exists."
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("lets admins update another user's display timezone", async () => {
    const { updateUserIdentityAction } = await import("@/app/admin/users/actions");

    await expect(
      updateUserIdentityAction(null, profileForm({ displayTimeZone: "UTC", id: "user_2" }))
    ).resolves.toEqual({
      message: "User updated."
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_2" },
      data: {
        displayTimeZone: "UTC",
        email: "user@example.com",
        name: "Test User"
      }
    });
  });

  it("routes a site admin's own email change through Profile verification", async () => {
    const { updateUserIdentityAction } = await import("@/app/admin/users/actions");
    prisma.user.findUnique.mockResolvedValue({ id: "admin_1", role: "ADMIN", email: "admin@example.com" });

    await expect(updateUserIdentityAction(null, profileForm({ id: "admin_1", email: "new@example.com" })))
      .resolves.toMatchObject({ error: expect.stringContaining("Profile") });
    expect(prisma.user.update).not.toHaveBeenCalled();

    await expect(updateUserIdentityAction(null, profileForm({ id: "admin_1", email: "ADMIN@example.com", name: "Updated Admin", displayTimeZone: "UTC" })))
      .resolves.toEqual({ message: "User updated." });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "admin_1" },
      data: { displayTimeZone: "UTC", email: "admin@example.com", name: "Updated Admin" }
    });
  });

  it("lets admins save another user's identity and role together", async () => {
    const { updateUserIdentityAction } = await import("@/app/admin/users/actions");
    prisma.user.findUnique.mockResolvedValue({ id: "user_2", role: "USER" });

    await expect(
      updateUserIdentityAction(null, profileForm({ id: "user_2", role: "ADMIN" }))
    ).resolves.toEqual({ message: "User updated." });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_2" },
      data: {
        displayTimeZone: "America/Los_Angeles",
        email: "user@example.com",
        name: "Test User",
        role: "ADMIN"
      }
    });
  });

  it("does not let an admin change their own role in the combined form", async () => {
    const { updateUserIdentityAction } = await import("@/app/admin/users/actions");
    prisma.user.findUnique.mockResolvedValue({ id: "admin_1", role: "ADMIN" });

    await expect(
      updateUserIdentityAction(null, profileForm({ id: "admin_1", role: "USER" }))
    ).resolves.toEqual({ error: "You cannot change your own role." });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("does not demote the last admin through the combined form", async () => {
    const { updateUserIdentityAction } = await import("@/app/admin/users/actions");
    prisma.user.findUnique.mockResolvedValue({ id: "user_2", role: "ADMIN" });
    prisma.user.count.mockResolvedValue(1);

    await expect(
      updateUserIdentityAction(null, profileForm({ id: "user_2", role: "USER" }))
    ).resolves.toEqual({ error: "At least one admin user is required." });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("lets site admins set a custom per-user upload limit", async () => {
    const { updateUserUploadLimitAction } = await import("@/app/admin/users/actions");
    const formData = new FormData();
    formData.set("id", "user_2");
    formData.set("uploadLimitMode", "custom");
    formData.set("uploadMaxMegabytes", "50");

    await expect(updateUserUploadLimitAction(null, formData)).resolves.toEqual({
      message: "Upload limit updated."
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user_2" },
      data: { uploadLimitUnlimited: false, uploadMaxBytes: 50n * 1024n * 1024n }
    });
    expect(nextCache.revalidatePath).toHaveBeenCalledWith("/admin/tools");
  });

  it("lets site admins remove the Surls upload limit for a user", async () => {
    const { updateUserUploadLimitAction } = await import("@/app/admin/users/actions");
    const formData = new FormData();
    formData.set("id", "user_2");
    formData.set("uploadLimitMode", "unlimited");

    await expect(updateUserUploadLimitAction(null, formData)).resolves.toEqual({
      message: "Upload limit updated."
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user_2" },
      data: { uploadLimitUnlimited: true, uploadMaxBytes: null }
    });
  });

  it("regenerates backup codes with a shared generated timestamp", async () => {
    const { regenerateBackupCodesAction } = await import("@/app/admin/profile/actions");
    const formData = new FormData();
    formData.set("csrf", "csrf-token");
    formData.set("code", "123456");
    backupCodes.generateBackupCodes.mockReturnValue(["ABCDE-FGHIJ", "KLMNO-PQRST"]);
    backupCodes.hashBackupCode.mockImplementation(async (code: string) => `hash:${code}`);

    const result = await regenerateBackupCodesAction(null, formData);

    expect(result.codes).toEqual(["ABCDE-FGHIJ", "KLMNO-PQRST"]);
    const generatedAt = new Date(result.generatedAt!);
    expect(Number.isNaN(generatedAt.getTime())).toBe(false);
    expect(backupTx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(String(backupTx.$queryRaw.mock.calls[1]?.[0]?.join(""))).toContain('FROM "Session"');
    expect(String(backupTx.$queryRaw.mock.calls[1]?.[0]?.join(""))).toContain("FOR UPDATE");
    expect(backupTx.backupCode.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    expect(backupTx.backupCode.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "user_1", codeHash: "hash:ABCDE-FGHIJ", createdAt: generatedAt },
        { userId: "user_1", codeHash: "hash:KLMNO-PQRST", createdAt: generatedAt }
      ]
    });
    expect(backupTx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(backupTx.backupCode.deleteMany.mock.invocationCallOrder[0]);
    expect(backupTx.backupCode.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(backupTx.backupCode.createMany.mock.invocationCallOrder[0]);
    expect(nextCache.revalidatePath).toHaveBeenCalledWith("/admin/profile");
  });

  it("serializes concurrent regenerations so only the last completed set remains usable", async () => {
    const { regenerateBackupCodesAction } = await import("@/app/admin/profile/actions");
    const activeHashes = new Set(["hash:OLD"]);
    let lockTail = Promise.resolve();
    backupCodes.generateBackupCodes.mockReturnValueOnce(["FIRST-CODES"]).mockReturnValueOnce(["SECOND-CODE"]);
    backupCodes.hashBackupCode.mockImplementation(async (code: string) => `hash:${code}`);
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof backupTx) => Promise<unknown>) => {
      let releaseLock: (() => void) | undefined;
      const tx = {
        $queryRaw: vi.fn(async (parts: TemplateStringsArray) => {
          if (String(parts[0]).includes('"Session"')) {
            return [{ userId: "user_1", createdAt: new Date("2026-09-26T12:00:00Z"), expiresAt: new Date(Date.now() + 60_000) }];
          }
          const previous = lockTail;
          lockTail = new Promise<void>((resolve) => { releaseLock = resolve; });
          await previous;
          return [{ id: "user_1" }];
        }),
        backupCode: {
          deleteMany: vi.fn(async () => {
            const count = activeHashes.size;
            activeHashes.clear();
            return { count };
          }),
          createMany: vi.fn(async ({ data }: { data: { codeHash: string }[] }) => {
            if (data[0]?.codeHash === "hash:FIRST-CODES") await new Promise((resolve) => setTimeout(resolve, 20));
            for (const row of data) activeHashes.add(row.codeHash);
            return { count: data.length };
          })
        },
        session: { deleteMany: vi.fn() },
        totpCredential: {
          findUnique: vi.fn(async () => ({ id: "totp_1", enabled: true, secretEncrypted: "encrypted", enabledAt: new Date("2026-09-25T12:00:00Z") })),
          deleteMany: vi.fn()
        }
      };
      try {
        return await callback(tx);
      } finally {
        releaseLock?.();
      }
    });
    const first = new FormData();
    first.set("csrf", "csrf-token");
    first.set("code", "123456");
    const second = new FormData();
    second.set("csrf", "csrf-token");
    second.set("code", "654321");

    const results = await Promise.all([
      regenerateBackupCodesAction(null, first), regenerateBackupCodesAction(null, second)
    ]);
    expect(results.map((result) => result.codes)).toEqual([["FIRST-CODES"], ["SECOND-CODE"]]);
    expect([...activeHashes]).toEqual(["hash:SECOND-CODE"]);
  });

  it("rejects a regeneration paused during hashing after disable and re-enrollment change the factor", async () => {
    const { disableTotpAction, regenerateBackupCodesAction } = await import("@/app/admin/profile/actions");
    let credential: { id: string; enabled: boolean; secretEncrypted: string; enabledAt: Date } | null = {
      id: "totp_old", enabled: true, secretEncrypted: "old-secret", enabledAt: new Date("2026-09-25T12:00:00Z")
    };
    const activeHashes = new Set(["hash:old-backup"]);
    prisma.totpCredential.findUnique.mockImplementation(async () => credential);
    backupTx.totpCredential.findUnique.mockImplementation(async () => credential);
    backupTx.totpCredential.deleteMany.mockImplementation(async () => { credential = null; return { count: 1 }; });
    backupTx.backupCode.deleteMany.mockImplementation(async () => { activeHashes.clear(); return { count: 1 }; });
    backupTx.backupCode.createMany.mockImplementation(async ({ data }: { data: { codeHash: string }[] }) => {
      for (const row of data) activeHashes.add(row.codeHash);
      return { count: data.length };
    });
    backupCodes.generateBackupCodes.mockReturnValue(["ATTACK-CODE"]);
    let hashStarted = () => {};
    const hashing = new Promise<void>((resolve) => { hashStarted = resolve; });
    let releaseHash = () => {};
    const hashBarrier = new Promise<void>((resolve) => { releaseHash = resolve; });
    backupCodes.hashBackupCode.mockImplementation(async () => {
      hashStarted();
      await hashBarrier;
      return "hash:ATTACK-CODE";
    });
    const regenerateForm = new FormData();
    regenerateForm.set("csrf", "csrf-token");
    regenerateForm.set("code", "123456");
    const regeneration = regenerateBackupCodesAction(null, regenerateForm);
    await hashing;

    const disableForm = new FormData();
    disableForm.set("csrf", "csrf-token");
    disableForm.set("code", "654321");
    expect(await disableTotpAction(null, disableForm)).toEqual({ message: "TOTP disabled." });
    expect(credential).toBeNull();
    // The new enrollment committed before the hashing request could enter its transaction.
    credential = { id: "totp_new", enabled: true, secretEncrypted: "new-secret", enabledAt: new Date("2026-09-26T13:00:00Z") };
    activeHashes.clear();
    activeHashes.add("hash:new-enrollment-code");
    releaseHash();

    const result = await regeneration;
    expect(result).toMatchObject({ error: expect.stringContaining("session or authenticator changed") });
    expect(result.codes).toBeUndefined();
    expect([...activeHashes]).toEqual(["hash:new-enrollment-code"]);
    expect(backupTx.backupCode.deleteMany).not.toHaveBeenCalled();
    expect(backupTx.backupCode.createMany).not.toHaveBeenCalled();
    expect(backupTx.$queryRaw).toHaveBeenCalledTimes(4);
    expect(audit.auditLog).toHaveBeenCalledTimes(1);
  });

  it("rejects a regeneration if its session is revoked before the locked mutation", async () => {
    const { regenerateBackupCodesAction } = await import("@/app/admin/profile/actions");
    backupTx.$queryRaw.mockImplementation(async (parts: TemplateStringsArray) =>
      String(parts[0]).includes('"Session"') ? [] : [{ id: "user_1" }]);
    backupCodes.generateBackupCodes.mockReturnValue(["ATTACK-CODE"]);
    backupCodes.hashBackupCode.mockResolvedValue("hash:ATTACK-CODE");
    const formData = new FormData();
    formData.set("csrf", "csrf-token");
    formData.set("code", "123456");

    const result = await regenerateBackupCodesAction(null, formData);
    expect(result).toMatchObject({ error: expect.stringContaining("session or authenticator changed") });
    expect(result.codes).toBeUndefined();
    expect(backupTx.backupCode.deleteMany).not.toHaveBeenCalled();
    expect(audit.auditLog).not.toHaveBeenCalled();
  });

  it("deletes backup codes under the same user lock and audits the locked row count", async () => {
    const { deleteBackupCodesAction } = await import("@/app/admin/profile/actions");
    auth.getCurrentSession.mockResolvedValue({ id: "session_admin", userId: "admin_1" });
    backupTx.$queryRaw.mockImplementation(async (parts: TemplateStringsArray) =>
      String(parts[0]).includes('"Session"')
        ? [{ userId: "admin_1", createdAt: new Date("2026-09-26T12:00:00Z"), expiresAt: new Date(Date.now() + 60_000) }]
        : [{ id: "admin_1" }]);
    backupTx.backupCode.deleteMany.mockResolvedValue({ count: 2 });
    const formData = new FormData();
    formData.set("csrf", "csrf-token");

    await deleteBackupCodesAction(formData);

    expect(backupTx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(String(backupTx.$queryRaw.mock.calls[1]?.[0]?.join(""))).toContain('FROM "Session"');
    expect(String(backupTx.$queryRaw.mock.calls[1]?.[0]?.join(""))).toContain("FOR UPDATE");
    expect(backupTx.backupCode.deleteMany).toHaveBeenCalledWith({ where: { userId: "admin_1" } });
    expect(backupTx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(backupTx.backupCode.deleteMany.mock.invocationCallOrder[0]);
    expect(audit.auditLog).toHaveBeenCalledWith(expect.objectContaining({
      userId: "admin_1", details: { count: 2 }
    }));
  });

  it("does not delete backup codes after the requesting admin session is revoked", async () => {
    const { deleteBackupCodesAction } = await import("@/app/admin/profile/actions");
    auth.getCurrentSession.mockResolvedValue({ id: "session_admin", userId: "admin_1" });
    backupTx.$queryRaw.mockImplementation(async (parts: TemplateStringsArray) =>
      String(parts[0]).includes('"Session"') ? [] : [{ id: "admin_1" }]);
    const formData = new FormData();
    formData.set("csrf", "csrf-token");

    await deleteBackupCodesAction(formData);

    expect(backupTx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(backupTx.backupCode.deleteMany).not.toHaveBeenCalled();
    expect(audit.auditLog).not.toHaveBeenCalled();
  });

  it("does not regenerate backup codes from a session created before TOTP enrollment", async () => {
    const { regenerateBackupCodesAction } = await import("@/app/admin/profile/actions");
    auth.getCurrentSession.mockResolvedValue({ id: "old_session", userId: "user_1", createdAt: new Date("2026-09-24T12:00:00Z") });
    const formData = new FormData();
    formData.set("csrf", "csrf-token");
    formData.set("code", "123456");
    expect(await regenerateBackupCodesAction(null, formData)).toMatchObject({ error: expect.stringContaining("Sign in again") });
    expect(totp.verifyTotpCode).not.toHaveBeenCalled();
    expect(prisma.backupCode.deleteMany).not.toHaveBeenCalled();
  });

  it("requires an enabled TOTP credential and a fresh code for backup regeneration", async () => {
    const { regenerateBackupCodesAction } = await import("@/app/admin/profile/actions");
    const formData = new FormData();
    formData.set("csrf", "csrf-token");
    prisma.totpCredential.findUnique.mockResolvedValueOnce(null);
    expect(await regenerateBackupCodesAction(null, formData)).toMatchObject({ error: expect.stringContaining("Enable TOTP") });
    expect(await regenerateBackupCodesAction(null, formData)).toMatchObject({ error: expect.stringContaining("current authenticator") });
    formData.set("code", "123456");
    totp.verifyTotpCode.mockResolvedValueOnce(false);
    expect(await regenerateBackupCodesAction(null, formData)).toMatchObject({ error: expect.stringContaining("current authenticator") });
    rateLimit.checkRateLimit.mockResolvedValueOnce({ allowed: true }).mockResolvedValueOnce({ allowed: false });
    expect(await regenerateBackupCodesAction(null, formData)).toMatchObject({ error: expect.stringContaining("already used") });
    expect(prisma.backupCode.deleteMany).not.toHaveBeenCalled();
  });

  it("logs out every session except the current session", async () => {
    const { logoutOtherSessionsAction } = await import("@/app/admin/profile/actions");
    const formData = new FormData();
    formData.set("csrf", "csrf-token");
    backupTx.session.deleteMany.mockResolvedValue({ count: 2 });

    await logoutOtherSessionsAction(formData);

    expect(backupTx.session.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        id: { not: "session_current" }
      }
    });
    expect(backupTx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(String(backupTx.$queryRaw.mock.calls[0]?.[0]?.join(""))).toContain('FROM "User"');
    expect(String(backupTx.$queryRaw.mock.calls[1]?.[0]?.join(""))).toContain('FROM "Session"');
    expect(String(backupTx.$queryRaw.mock.calls[1]?.[0]?.join(""))).toContain("FOR UPDATE");
    expect(backupTx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(backupTx.session.deleteMany.mock.invocationCallOrder[0]);
    expect(nextCache.revalidatePath).toHaveBeenCalledWith("/admin/profile");
  });

  it("does not log out other sessions after its own session was revoked", async () => {
    const { logoutOtherSessionsAction } = await import("@/app/admin/profile/actions");
    backupTx.$queryRaw.mockImplementation(async (parts: TemplateStringsArray) =>
      String(parts[0]).includes('"Session"') ? [] : [{ id: "user_1" }]);
    const formData = new FormData();
    formData.set("csrf", "csrf-token");

    await expect(logoutOtherSessionsAction(formData)).rejects.toThrow("Unauthorized");
    expect(backupTx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(backupTx.session.deleteMany).not.toHaveBeenCalled();
    expect(audit.auditLog).not.toHaveBeenCalled();
  });

  it("lets a user log out one of their other sessions", async () => {
    const { revokeSessionAction } = await import("@/app/admin/profile/actions");
    const formData = new FormData();
    formData.set("csrf", "csrf-token");
    formData.set("sessionId", "session_other");
    prisma.session.deleteMany.mockResolvedValue({ count: 1 });

    await revokeSessionAction(formData);

    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "session_other",
        userId: "user_1"
      }
    });
  });

  it("never revokes the current session through the single-session action", async () => {
    const { revokeSessionAction } = await import("@/app/admin/profile/actions");
    const formData = new FormData();
    formData.set("csrf", "csrf-token");
    formData.set("sessionId", "session_current");

    await revokeSessionAction(formData);

    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
  });
});
