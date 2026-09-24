import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  externalIdentity: { findUnique: vi.fn(), create: vi.fn() },
  user: { findUnique: vi.fn(), create: vi.fn() }
}));
const prisma = vi.hoisted(() => ({ $transaction: vi.fn(async (fn: (value: unknown) => unknown) => fn(tx)) }));
const settings = vi.hoisted(() => ({ getSetting: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/settings", () => settings);
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn(async () => "random-hash") }));

import { resolveExternalIdentity } from "@/lib/external-identity";

describe("external identity matching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings.getSetting.mockResolvedValue(false);
    tx.externalIdentity.findUnique.mockResolvedValue(null);
    tx.user.findUnique.mockResolvedValue(null);
  });

  it("matches an existing user only when the provider verified the email", async () => {
    tx.user.findUnique.mockResolvedValue({ id: "user_1" });
    await expect(resolveExternalIdentity("google", { subject: "google_1", email: "USER@example.com", emailVerified: true, name: null }, null)).resolves.toBe("user_1");
    expect(tx.user.findUnique).toHaveBeenCalledWith({ where: { email: "user@example.com" }, select: { id: true } });
    expect(tx.externalIdentity.create).toHaveBeenCalledWith({ data: { provider: "google", subject: "google_1", userId: "user_1" } });
  });

  it("never matches an unverified Facebook email", async () => {
    await expect(resolveExternalIdentity("facebook", { subject: "fb_1", email: "admin@example.com", emailVerified: false, name: null }, null))
      .rejects.toThrow("Connect this provider");
    expect(tx.user.findUnique).not.toHaveBeenCalled();
  });

  it("does not create an unknown user while automatic creation is disabled", async () => {
    await expect(resolveExternalIdentity("google", { subject: "google_2", email: "new@example.com", emailVerified: true, name: null }, null))
      .rejects.toThrow("Ask an admin to create one");
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it("creates only a User when automatic creation is enabled", async () => {
    settings.getSetting.mockResolvedValue(true);
    tx.user.create.mockResolvedValue({ id: "new_1" });
    await expect(resolveExternalIdentity("discord", { subject: "discord_1", email: "new@example.com", emailVerified: true, name: "New User" }, null))
      .resolves.toBe("new_1");
    expect(tx.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({ email: "new@example.com", role: "USER", passwordHash: "random-hash" }), select: { id: true } });
  });

  it("rejects linking an external account owned by another user", async () => {
    tx.externalIdentity.findUnique.mockResolvedValue({ userId: "other_1" });
    await expect(resolveExternalIdentity("x", { subject: "x_1", email: null, emailVerified: false, name: null }, "user_1"))
      .rejects.toThrow("another Surls user");
    expect(tx.externalIdentity.create).not.toHaveBeenCalled();
  });
});
