import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireSiteAdmin: vi.fn() }));
const csrf = vi.hoisted(() => ({ validateCsrf: vi.fn() }));
const settings = vi.hoisted(() => ({ getSetting: vi.fn(), setSetting: vi.fn() }));
const prisma = vi.hoisted(() => ({ externalIdentity: { findMany: vi.fn() } }));
const providers = vi.hoisted(() => ({
  getConfiguredExternalProviders: vi.fn(), saveExternalProviderSetting: vi.fn(), disableExternalProviderSetting: vi.fn(), removeExternalProviderSetting: vi.fn(),
  externalProviderKey: vi.fn((config: { provider: string }) => config.provider),
  externalProviderType: vi.fn((value: string) => value === "google" || value === "github" ? value : value.startsWith("google--") ? "google" : null),
  isExternalProvider: vi.fn((value: string) => value === "google" || value === "github"),
  ExternalProviderSettingsError: class ExternalProviderSettingsError extends Error {}
}));
const audit = vi.hoisted(() => ({ auditLog: vi.fn() }));
const navigation = vi.hoisted(() => ({ redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/csrf", () => csrf);
vi.mock("@/lib/settings", () => settings);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/external-provider-settings", () => providers);
vi.mock("@/lib/audit", () => audit);
vi.mock("next/navigation", () => navigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin-toast", () => ({ adminToastPath: (path: string, _type: string, message: string) => `${path}?toast=${message}` }));

function form() {
  const data = new FormData();
  data.set("provider", "google");
  data.set("clientId", "client");
  data.set("clientSecret", "new-secret");
  return data;
}

describe("external provider admin actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireSiteAdmin.mockResolvedValue({ id: "admin_1" });
    settings.getSetting.mockResolvedValue(false);
    prisma.externalIdentity.findMany.mockResolvedValue([{ provider: "google" }]);
    providers.getConfiguredExternalProviders.mockResolvedValue([{ key: "google", provider: "google" }]);
  });

  it("does not change an admin's only available provider when local login is disabled", async () => {
    const { saveExternalProviderAction, disableExternalProviderAction, removeExternalProviderAction } = await import("@/app/admin/settings/external-provider-actions");
    await expect(saveExternalProviderAction(form())).rejects.toThrow("connect another provider");
    await expect(disableExternalProviderAction(form())).rejects.toThrow("connect another provider");
    await expect(removeExternalProviderAction(form())).rejects.toThrow("connect another provider");
    expect(providers.saveExternalProviderSetting).not.toHaveBeenCalled();
    expect(providers.disableExternalProviderSetting).not.toHaveBeenCalled();
    expect(providers.removeExternalProviderSetting).not.toHaveBeenCalled();
  });

  it("allows changing a provider after another connected provider is available", async () => {
    prisma.externalIdentity.findMany.mockResolvedValue([{ provider: "google" }, { provider: "github" }]);
    providers.getConfiguredExternalProviders.mockResolvedValue([{ key: "google", provider: "google" }, { key: "github", provider: "github" }]);
    const { disableExternalProviderAction } = await import("@/app/admin/settings/external-provider-actions");
    await expect(disableExternalProviderAction(form())).rejects.toThrow("Sign-in provider disabled");
    expect(providers.disableExternalProviderSetting).toHaveBeenCalledWith("google");
  });

  it("returns to the external sign-in panel after saving a provider", async () => {
    settings.getSetting.mockResolvedValue(true);
    const { saveExternalProviderAction } = await import("@/app/admin/settings/external-provider-actions");
    await expect(saveExternalProviderAction(form())).rejects.toThrow("/admin/settings?externalSignIn=open");
    expect(providers.saveExternalProviderSetting).toHaveBeenCalledWith("google", expect.objectContaining({ clientId: "client" }));
  });

  it("removes the selected profile and returns to the provider panel", async () => {
    settings.getSetting.mockResolvedValue(true);
    const data = form();
    const key = "google--11111111-1111-4111-8111-111111111111";
    data.set("key", key);
    const { removeExternalProviderAction } = await import("@/app/admin/settings/external-provider-actions");
    await expect(removeExternalProviderAction(data)).rejects.toThrow("/admin/settings?externalSignIn=open?toast=Sign-in provider removed.");
    expect(providers.removeExternalProviderSetting).toHaveBeenCalledWith(key);
    expect(audit.auditLog).toHaveBeenCalledWith(expect.objectContaining({ entityId: key, details: { provider: "google", removed: true } }));
  });

  it("requires a valid CSRF token and site admin before removal", async () => {
    const { removeExternalProviderAction } = await import("@/app/admin/settings/external-provider-actions");
    csrf.validateCsrf.mockImplementationOnce(() => { throw new Error("invalid csrf"); });
    await expect(removeExternalProviderAction(form())).rejects.toThrow("The form expired");
    expect(auth.requireSiteAdmin).not.toHaveBeenCalled();
    auth.requireSiteAdmin.mockResolvedValueOnce(null);
    await expect(removeExternalProviderAction(form())).rejects.toThrow("Sign in again");
    expect(providers.removeExternalProviderSetting).not.toHaveBeenCalled();
  });

  it("allows adding a second profile while the connected profile remains available", async () => {
    const data = form();
    const key = "google--11111111-1111-4111-8111-111111111111";
    data.set("key", key);
    const { saveExternalProviderAction } = await import("@/app/admin/settings/external-provider-actions");
    await expect(saveExternalProviderAction(data)).rejects.toThrow("sign-in saved and enabled");
    expect(providers.saveExternalProviderSetting).toHaveBeenCalledWith("google", expect.objectContaining({ key }));
  });

  it("refuses to turn off external sign-in while local login is disabled", async () => {
    const { setExternalLoginEnabledAction } = await import("@/app/admin/settings/external-provider-actions");
    const data = new FormData();
    data.set("enabled", "false");
    await expect(setExternalLoginEnabledAction(data)).rejects.toThrow("Enable password and passkey sign-in");
    expect(settings.setSetting).not.toHaveBeenCalled();
  });

  it("turns off external sign-in when local login is available", async () => {
    settings.getSetting.mockResolvedValue(true);
    const { setExternalLoginEnabledAction } = await import("@/app/admin/settings/external-provider-actions");
    const data = new FormData();
    data.set("enabled", "false");
    await expect(setExternalLoginEnabledAction(data)).rejects.toThrow("External sign-in disabled");
    expect(settings.setSetting).toHaveBeenCalledWith("externalLoginEnabled", false);
  });
});
