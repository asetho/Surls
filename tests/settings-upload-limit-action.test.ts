import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireSiteAdmin: vi.fn() }));
const csrf = vi.hoisted(() => ({ validateCsrf: vi.fn() }));
const settings = vi.hoisted(() => ({
  getSettings: vi.fn(),
  normalizeSiteName: vi.fn((value: FormDataEntryValue | null) => String(value ?? "Surls")),
  setSetting: vi.fn()
}));
const audit = vi.hoisted(() => ({ auditLog: vi.fn() }));
const prisma = vi.hoisted(() => ({ externalIdentity: { findMany: vi.fn() } }));
const providers = vi.hoisted(() => ({ getConfiguredExternalProviders: vi.fn() }));
const nextCache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const navigation = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  })
}));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/csrf", () => csrf);
vi.mock("@/lib/settings", () => settings);
vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/external-provider-settings", () => providers);
vi.mock("next/cache", () => nextCache);
vi.mock("next/navigation", () => navigation);
vi.mock("@/lib/admin-toast", () => ({
  adminToastPath: (path: string) => path,
  adminToastPathFromFormData: () => "/admin/settings?saved=true"
}));

function settingsForm(mode: "limited" | "unlimited", megabytes = "25") {
  const formData = new FormData();
  formData.set("siteName", "Surls");
  formData.set("displayTimeZone", "America/New_York");
  formData.set("siteUploadLimitMode", mode);
  formData.set("siteUploadMaxMegabytes", megabytes);
  formData.set("localLoginEnabled", "on");
  return formData;
}

function signInForm(localLoginEnabled: boolean, externalAutoProvisionUsers = false) {
  const formData = new FormData();
  if (localLoginEnabled) formData.set("localLoginEnabled", "on");
  if (externalAutoProvisionUsers) formData.set("externalAutoProvisionUsers", "on");
  return formData;
}

describe("settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireSiteAdmin.mockResolvedValue({ id: "admin_1" });
    settings.setSetting.mockResolvedValue({});
    settings.getSettings.mockResolvedValue({ localLoginEnabled: true, externalLoginEnabled: true });
    prisma.externalIdentity.findMany.mockResolvedValue([]);
    providers.getConfiguredExternalProviders.mockResolvedValue([]);
  });

  it("does not change sign-in methods when saving site settings", async () => {
    const { updateSettingsAction } = await import("@/app/admin/settings/actions");
    await expect(updateSettingsAction(settingsForm("limited"))).rejects.toThrow("redirect:/admin/settings?saved=true");
    expect(settings.setSetting).not.toHaveBeenCalledWith("localLoginEnabled", expect.anything());
    expect(settings.setSetting).not.toHaveBeenCalledWith("externalAutoProvisionUsers", expect.anything());
  });

  it("refuses to disable local sign-in without a connected provider", async () => {
    const { updateSignInMethodsAction } = await import("@/app/admin/settings/actions");
    await expect(updateSignInMethodsAction(signInForm(false))).rejects.toThrow("redirect:/admin/settings?saved=true");
    expect(settings.setSetting).not.toHaveBeenCalledWith("localLoginEnabled", false);
  });

  it("refuses to disable local sign-in while external sign-in is off", async () => {
    settings.getSettings.mockResolvedValue({ localLoginEnabled: true, externalLoginEnabled: false });
    const { updateSignInMethodsAction } = await import("@/app/admin/settings/actions");
    await expect(updateSignInMethodsAction(signInForm(false))).rejects.toThrow("redirect:/admin/settings?saved=true");
    expect(settings.setSetting).not.toHaveBeenCalledWith("localLoginEnabled", false);
    expect(prisma.externalIdentity.findMany).not.toHaveBeenCalled();
  });

  it("saves sign-in methods without changing the other site settings", async () => {
    const { updateSignInMethodsAction } = await import("@/app/admin/settings/actions");
    await expect(updateSignInMethodsAction(signInForm(true, true))).rejects.toThrow("redirect:/admin/settings?saved=true");
    expect(settings.setSetting).toHaveBeenCalledWith("localLoginEnabled", true);
    expect(settings.setSetting).toHaveBeenCalledWith("externalAutoProvisionUsers", true);
    expect(settings.setSetting).toHaveBeenCalledTimes(2);
    expect(nextCache.revalidatePath).toHaveBeenCalledWith("/admin/profile");
    expect(nextCache.revalidatePath).toHaveBeenCalledWith("/bookmarklet");
  });

  it("stores a site-wide maximum upload size", async () => {
    const { updateSettingsAction } = await import("@/app/admin/settings/actions");

    await expect(updateSettingsAction(settingsForm("limited", "100"))).rejects.toThrow("redirect:/admin/settings?saved=true");

    expect(settings.setSetting).toHaveBeenCalledWith("uploadMaxBytes", 100 * 1024 * 1024);
    expect(nextCache.revalidatePath).toHaveBeenCalledWith("/admin/tools");
    expect(nextCache.revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("stores an explicit no-limit policy", async () => {
    const { updateSettingsAction } = await import("@/app/admin/settings/actions");

    await expect(updateSettingsAction(settingsForm("unlimited"))).rejects.toThrow("redirect:/admin/settings?saved=true");

    expect(settings.setSetting).toHaveBeenCalledWith("uploadMaxBytes", null);
    expect(audit.auditLog).toHaveBeenCalledWith(expect.objectContaining({
      details: expect.objectContaining({ uploadMaxBytes: null })
    }));
  });
});
