import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
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

const prisma = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/csrf", () => csrf);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next/cache", () => nextCache);
vi.mock("next/navigation", () => navigation);
vi.mock("@/lib/audit", () => ({ auditLog: vi.fn() }));
vi.mock("@/lib/backup-codes", () => ({
  generateBackupCodes: vi.fn(() => []),
  hashBackupCode: vi.fn()
}));
vi.mock("@/lib/settings", () => ({ getSiteName: vi.fn() }));
vi.mock("@/lib/totp", () => ({
  createTotpSecret: vi.fn(),
  verifyTotpCode: vi.fn()
}));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn() }));

function profileForm(
  fields: { displayTimeZone?: string; email?: string; id?: string; mobileMenuSide?: string; name?: string } = {}
) {
  const formData = new FormData();
  formData.set("csrf", "csrf-token");
  if (fields.id) formData.set("id", fields.id);
  formData.set("displayTimeZone", fields.displayTimeZone ?? "America/Los_Angeles");
  formData.set("email", fields.email ?? "  USER@Example.COM  ");
  formData.set("mobileMenuSide", fields.mobileMenuSide ?? "left");
  formData.set("name", fields.name ?? "  Test User  ");
  return formData;
}

describe("profile identity actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAdmin.mockResolvedValue({ id: "user_1", role: "USER" });
    auth.requireSiteAdmin.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ id: "user_1" });
    prisma.user.update.mockResolvedValue({});
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
});
