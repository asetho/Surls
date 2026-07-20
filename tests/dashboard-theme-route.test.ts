import { beforeEach, describe, expect, it, vi } from "vitest";

const audit = vi.hoisted(() => ({ auditLog: vi.fn() }));
const auth = vi.hoisted(() => ({ requireSiteAdmin: vi.fn() }));
const csrf = vi.hoisted(() => ({ validateCsrf: vi.fn() }));
const dashboardTheme = vi.hoisted(() => ({
  DEFAULT_DASHBOARD_THEME: { dark: { accent: "#000000" }, light: { accent: "#ffffff" } },
  dashboardThemeFromFormData: vi.fn()
}));
const nextCache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const settings = vi.hoisted(() => ({ setSetting: vi.fn() }));

vi.mock("@prisma/client", () => ({ AuditAction: { SETTINGS_CHANGED: "SETTINGS_CHANGED" } }));
vi.mock("next/cache", () => nextCache);
vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/csrf", () => csrf);
vi.mock("@/lib/dashboard-theme", () => dashboardTheme);
vi.mock("@/lib/settings", () => settings);

function requestWithFormData(formData: FormData) {
  return { formData: vi.fn().mockResolvedValue(formData) } as unknown as Request;
}

describe("POST /api/admin/dashboard-theme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireSiteAdmin.mockResolvedValue({ id: "admin_1" });
    dashboardTheme.dashboardThemeFromFormData.mockReturnValue({ dark: { accent: "#112233" }, light: { accent: "#abcdef" } });
    settings.setSetting.mockResolvedValue(undefined);
    audit.auditLog.mockResolvedValue(undefined);
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
});
