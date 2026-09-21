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

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
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
vi.mock("@/lib/audit", () => ({ auditLog: vi.fn() }));
const backupCodes = vi.hoisted(() => ({
  generateBackupCodes: vi.fn<() => string[]>(() => []),
  hashBackupCode: vi.fn<(code: string) => Promise<string>>()
}));

vi.mock("@/lib/backup-codes", () => backupCodes);
vi.mock("@/lib/settings", () => ({ getSiteName: vi.fn() }));
vi.mock("@/lib/totp", () => ({
  createTotpSecret: vi.fn(),
  verifyTotpCode: vi.fn()
}));
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
    auth.requireAdmin.mockResolvedValue({ id: "user_1", role: "USER" });
    auth.getCurrentSession.mockResolvedValue({ id: "session_current", userId: "user_1" });
    auth.requireSiteAdmin.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
    backupCodes.generateBackupCodes.mockReturnValue([]);
    backupCodes.hashBackupCode.mockResolvedValue("hashed-backup-code");
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true });
    prisma.$transaction.mockResolvedValue([]);
    prisma.backupCode.create.mockResolvedValue({});
    prisma.backupCode.deleteMany.mockResolvedValue({ count: 0 });
    prisma.session.deleteMany.mockResolvedValue({ count: 0 });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ id: "user_1", role: "USER" });
    prisma.user.count.mockResolvedValue(2);
    prisma.user.update.mockResolvedValue({});
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
  });

  it("lets signed-in users update their own name and email", async () => {
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
    backupCodes.generateBackupCodes.mockReturnValue(["ABCDE-FGHIJ", "KLMNO-PQRST"]);
    backupCodes.hashBackupCode.mockImplementation(async (code: string) => `hash:${code}`);

    const result = await regenerateBackupCodesAction(null, formData);

    expect(result.codes).toEqual(["ABCDE-FGHIJ", "KLMNO-PQRST"]);
    const generatedAt = new Date(result.generatedAt);
    expect(Number.isNaN(generatedAt.getTime())).toBe(false);
    expect(prisma.backupCode.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    expect(prisma.backupCode.create).toHaveBeenCalledTimes(2);
    expect(prisma.backupCode.create).toHaveBeenNthCalledWith(1, {
      data: { userId: "user_1", codeHash: "hash:ABCDE-FGHIJ", createdAt: generatedAt }
    });
    expect(prisma.backupCode.create).toHaveBeenNthCalledWith(2, {
      data: { userId: "user_1", codeHash: "hash:KLMNO-PQRST", createdAt: generatedAt }
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      prisma.backupCode.deleteMany.mock.results[0]?.value,
      prisma.backupCode.create.mock.results[0]?.value,
      prisma.backupCode.create.mock.results[1]?.value
    ]);
    expect(nextCache.revalidatePath).toHaveBeenCalledWith("/admin/profile");
  });

  it("logs out every session except the current session", async () => {
    const { logoutOtherSessionsAction } = await import("@/app/admin/profile/actions");
    const formData = new FormData();
    formData.set("csrf", "csrf-token");
    prisma.session.deleteMany.mockResolvedValue({ count: 2 });

    await logoutOtherSessionsAction(formData);

    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        id: { not: "session_current" }
      }
    });
    expect(nextCache.revalidatePath).toHaveBeenCalledWith("/admin/profile");
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
