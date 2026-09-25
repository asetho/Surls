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

describe("site upload limit settings action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireSiteAdmin.mockResolvedValue({ id: "admin_1" });
    settings.setSetting.mockResolvedValue({});
    settings.getSettings.mockResolvedValue({ localLoginEnabled: true });
    prisma.externalIdentity.findMany.mockResolvedValue([]);
  });

  it("does not disable local sign-in from an older settings form", async () => {
    const { updateSettingsAction } = await import("@/app/admin/settings/actions");
    await expect(updateSettingsAction(settingsForm("limited"))).rejects.toThrow("redirect:/admin/settings?saved=true");
    expect(settings.setSetting).not.toHaveBeenCalledWith("localLoginEnabled", false);
  });

  it("refuses to disable local sign-in without a connected provider", async () => {
    const form = settingsForm("limited");
    form.set("authSettingsPresent", "1");
    const { updateSettingsAction } = await import("@/app/admin/settings/actions");
    await expect(updateSettingsAction(form)).rejects.toThrow("redirect:/admin/settings?saved=true");
    expect(settings.setSetting).not.toHaveBeenCalledWith("localLoginEnabled", false);
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
