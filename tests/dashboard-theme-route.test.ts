import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const audit = vi.hoisted(() => ({ auditLog: vi.fn() }));
const auth = vi.hoisted(() => ({ requireSiteAdmin: vi.fn() }));
const csrf = vi.hoisted(() => ({ validateCsrf: vi.fn() }));
const dashboardTheme = vi.hoisted(() => ({
  DEFAULT_DASHBOARD_THEME: { dark: { accent: "#000000" }, light: { accent: "#ffffff" } },
  dashboardThemeFromFormData: vi.fn()
}));
const nextCache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const settings = vi.hoisted(() => ({ setSetting: vi.fn() }));
const database = vi.hoisted(() => ({ $transaction: vi.fn() }));

vi.mock("@prisma/client", () => ({ AuditAction: { SETTINGS_CHANGED: "SETTINGS_CHANGED" } }));
vi.mock("next/cache", () => nextCache);
vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/csrf", () => csrf);
vi.mock("@/lib/dashboard-theme", () => dashboardTheme);
vi.mock("@/lib/settings", () => settings);
vi.mock("@/lib/prisma", () => ({ prisma: database }));
import { DEFAULT_SIDEBAR_BRANDING } from "@/lib/sidebar-branding";

function requestWithFormData(formData: FormData, origin: string | null = "http://localhost:3000") {
  return {
    formData: vi.fn().mockResolvedValue(formData),
    headers: new Headers(origin === null ? {} : { origin })
  } as unknown as NextRequest;
}

describe("POST /api/admin/dashboard-theme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireSiteAdmin.mockResolvedValue({ id: "admin_1" });
    dashboardTheme.dashboardThemeFromFormData.mockReturnValue({ dark: { accent: "#112233" }, light: { accent: "#abcdef" } });
    settings.setSetting.mockResolvedValue(undefined);
    audit.auditLog.mockResolvedValue(undefined);
    database.$transaction.mockImplementation((callback) => callback({ appSetting: {} }));
  });

  it("rejects anonymous requests before parsing their form body", async () => {
    auth.requireSiteAdmin.mockResolvedValue(null);
    const request = requestWithFormData(new FormData());
    const { POST } = await import("@/app/api/admin/dashboard-theme/route");

    const response = await POST(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sign in again to continue." });
    expect(request.formData).not.toHaveBeenCalled();
    expect(csrf.validateCsrf).not.toHaveBeenCalled();
  });

  it("parses and saves a valid site-admin theme request", async () => {
    const formData = new FormData();
    formData.set("csrf", "valid-token");
    formData.set("intent", "save");
    const request = requestWithFormData(formData);
    const { POST } = await import("@/app/api/admin/dashboard-theme/route");

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(request.formData).toHaveBeenCalledTimes(1);
    expect(csrf.validateCsrf).toHaveBeenCalledWith(formData);
    expect(settings.setSetting).toHaveBeenCalledWith("dashboardTheme", {
      dark: { accent: "#112233" },
      light: { accent: "#abcdef" }
    });
    expect(audit.auditLog).toHaveBeenCalledWith(expect.objectContaining({ userId: "admin_1" }));
  });

  it.each([null, "https://other.example.test"])("rejects an invalid request origin before parsing: %s", async (origin) => {
    const request = requestWithFormData(new FormData(), origin);
    const { POST } = await import("@/app/api/admin/dashboard-theme/route");

    expect((await POST(request)).status).toBe(403);
    expect(request.formData).not.toHaveBeenCalled();
    expect(csrf.validateCsrf).not.toHaveBeenCalled();
    expect(settings.setSetting).not.toHaveBeenCalled();
  });

  it("saves branding with the palette atomically and returns sizing and padding", async () => {
    const branding = { ...DEFAULT_SIDEBAR_BRANDING, logo: "placeholder", text: "Surls", logoHeight: 44, paddingX: 6, paddingY: 2 };
    const form = new FormData(); form.set("sidebarBranding", JSON.stringify(branding));
    const { POST } = await import("@/app/api/admin/dashboard-theme/route");
    const response = await POST(requestWithFormData(form));
    expect(response.status).toBe(200);
    expect(database.$transaction).toHaveBeenCalledOnce();
    expect(settings.setSetting).toHaveBeenCalledWith("sidebarBranding", branding, expect.any(Object));
    expect((await response.json()).sidebarBranding).toEqual(branding);
  });

  it("does not change branding when an older palette-only caller saves", async () => {
    const { POST } = await import("@/app/api/admin/dashboard-theme/route");
    await POST(requestWithFormData(new FormData()));
    expect(settings.setSetting).toHaveBeenCalledTimes(1);
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it("previews a valid image without writing settings or audit records", async () => {
    const form = new FormData(); form.set("intent", "preview-logo");
    form.set("logo", new File(['<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20"/></svg>'], "logo.svg"));
    const { POST } = await import("@/app/api/admin/dashboard-theme/route");
    const response = await POST(requestWithFormData(form));
    expect(response.status).toBe(200);
    expect((await response.json()).image).toMatch(/^data:image\/png;base64,/);
    expect(settings.setSetting).not.toHaveBeenCalled();
    expect(audit.auditLog).not.toHaveBeenCalled();
  });

  it("rejects empty custom branding before saving any colors", async () => {
    const form = new FormData(); form.set("sidebarBranding", JSON.stringify({ ...DEFAULT_SIDEBAR_BRANDING, logo: "custom" }));
    const { POST } = await import("@/app/api/admin/dashboard-theme/route");
    expect((await POST(requestWithFormData(form))).status).toBe(400);
    expect(settings.setSetting).not.toHaveBeenCalled();
  });

  it("resets both palette and branding", async () => {
    const form = new FormData(); form.set("intent", "reset");
    const { POST } = await import("@/app/api/admin/dashboard-theme/route");
    expect((await POST(requestWithFormData(form))).status).toBe(200);
    expect(settings.setSetting).toHaveBeenCalledWith("sidebarBranding", DEFAULT_SIDEBAR_BRANDING, expect.any(Object));
  });

  it("requires CSRF validation before previewing or saving a logo", async () => {
    csrf.validateCsrf.mockImplementationOnce(() => { throw new Error("Invalid CSRF"); });
    const form = new FormData(); form.set("intent", "preview-logo");
    const { POST } = await import("@/app/api/admin/dashboard-theme/route");
    expect((await POST(requestWithFormData(form))).status).toBe(400);
    expect(settings.setSetting).not.toHaveBeenCalled();
  });
});
