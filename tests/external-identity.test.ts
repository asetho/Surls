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
import type { ExternalProvider, ExternalProviderConfig } from "@/lib/external-provider-settings";

function config(provider: ExternalProvider): ExternalProviderConfig {
  return { key: provider, provider, id: "client", secret: "secret", label: provider, logoDataUrl: null, issuer: null, tenantId: null, source: "settings" };
}

describe("external identity matching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings.getSetting.mockResolvedValue(false);
    tx.externalIdentity.findUnique.mockResolvedValue(null);
    tx.user.findUnique.mockResolvedValue(null);
  });

  it("matches an existing user only when the provider verified the email", async () => {
    tx.user.findUnique.mockResolvedValue({ id: "user_1" });
    await expect(resolveExternalIdentity(config("google"), { subject: "google_1", email: "USER@example.com", emailVerified: true, name: null }, null)).resolves.toBe("user_1");
    expect(tx.user.findUnique).toHaveBeenCalledWith({ where: { email: "user@example.com" }, select: { id: true } });
    expect(tx.externalIdentity.create).toHaveBeenCalledWith({ data: { provider: "google", subject: "google_1", userId: "user_1" } });
  });

  it("keeps separate profiles of the same provider in separate identity namespaces", async () => {
    tx.user.findUnique.mockResolvedValue({ id: "user_1" });
    const first = { ...config("oidc"), key: "oidc--11111111-1111-4111-8111-111111111111", issuer: "https://auth.example.com/realms/one" };
    const second = { ...first, key: "oidc--22222222-2222-4222-8222-222222222222" };
    const profile = { subject: "subject_1", email: "user@example.com", emailVerified: true, name: null };
    await resolveExternalIdentity(first, profile, null);
    await resolveExternalIdentity(second, profile, null);
    const keys = tx.externalIdentity.create.mock.calls.map(([call]) => call.data.provider);
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("never matches an unverified Facebook email", async () => {
    await expect(resolveExternalIdentity(config("facebook"), { subject: "fb_1", email: "admin@example.com", emailVerified: false, name: null }, null))
      .rejects.toThrow("Connect this provider");
    expect(tx.user.findUnique).not.toHaveBeenCalled();
  });

  it("does not create an unknown user while automatic creation is disabled", async () => {
    await expect(resolveExternalIdentity(config("google"), { subject: "google_2", email: "new@example.com", emailVerified: true, name: null }, null))
      .rejects.toThrow("Ask an admin to create one");
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it("creates only a User when automatic creation is enabled", async () => {
    settings.getSetting.mockResolvedValue(true);
    tx.user.create.mockResolvedValue({ id: "new_1" });
    await expect(resolveExternalIdentity(config("discord"), { subject: "discord_1", email: "new@example.com", emailVerified: true, name: "New User" }, null))
      .resolves.toBe("new_1");
    expect(tx.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({ email: "new@example.com", role: "USER", passwordHash: "random-hash" }), select: { id: true } });
  });

  it("rejects linking an external account owned by another user", async () => {
    tx.externalIdentity.findUnique.mockResolvedValue({ userId: "other_1" });
    await expect(resolveExternalIdentity(config("x"), { subject: "x_1", email: null, emailVerified: false, name: null }, "user_1"))
      .rejects.toThrow("another Surls user");
    expect(tx.externalIdentity.create).not.toHaveBeenCalled();
  });
});
