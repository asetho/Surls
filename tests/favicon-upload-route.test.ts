import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireSiteAdmin: vi.fn() }));
const requestSecurity = vi.hoisted(() => ({
  readFormDataWithLimit: vi.fn(),
  requestOriginMatchesApp: vi.fn()
}));
const rateLimit = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const favicons = vi.hoisted(() => ({ faviconsFromUpload: vi.fn(), getFaviconManifestNames: vi.fn() }));
const settings = vi.hoisted(() => ({ getSettings: vi.fn(), setSetting: vi.fn() }));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/request", () => requestSecurity);
vi.mock("@/lib/rate-limit", () => rateLimit);
vi.mock("@/lib/favicons", () => favicons);
vi.mock("@/lib/settings", () => settings);
vi.mock("@/lib/audit", () => ({ auditLog: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function request() {
  return new NextRequest("http://localhost:3000/admin/settings/favicons", {
    body: "untrusted multipart bytes",
    headers: { "content-type": "multipart/form-data; boundary=test", origin: "http://localhost:3000" },
    method: "POST"
  });
}

describe("favicon upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestSecurity.requestOriginMatchesApp.mockReturnValue(true);
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true });
  });

  it("authenticates before reading multipart data", async () => {
    const { POST } = await import("@/app/admin/settings/favicons/route");
    auth.requireSiteAdmin.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(303);
    expect(requestSecurity.readFormDataWithLimit).not.toHaveBeenCalled();
    expect(favicons.faviconsFromUpload).not.toHaveBeenCalled();
  });

  it("rejects oversized multipart data before favicon decoding", async () => {
    const { POST } = await import("@/app/admin/settings/favicons/route");
    auth.requireSiteAdmin.mockResolvedValue({ id: "admin-1" });
    requestSecurity.readFormDataWithLimit.mockResolvedValue({ ok: false, error: "too_large" });

    const response = await POST(request());

    expect(response.status).toBe(303);
    expect(requestSecurity.readFormDataWithLimit).toHaveBeenCalledWith(expect.any(NextRequest), 5 * 1024 * 1024);
    expect(favicons.faviconsFromUpload).not.toHaveBeenCalled();
  });
});
