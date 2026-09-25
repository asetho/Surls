import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const external = vi.hoisted(() => ({
  EXTERNAL_AUTH_COOKIE: "surls_external_auth",
  externalAuthCookieOptions: vi.fn(() => ({ path: "/api/auth/external" })),
  encodeExternalAuth: vi.fn(() => "signed-pending-auth"),
  externalAuthorizationUrl: vi.fn(),
  newExternalAuthValues: vi.fn(() => ({ state: "state", verifier: "verifier", nonce: "nonce" }))
}));
const auth = vi.hoisted(() => ({ getCurrentSession: vi.fn() }));
const providers = vi.hoisted(() => ({ getExternalProviderConfig: vi.fn() }));
const rate = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const settings = vi.hoisted(() => ({ getSetting: vi.fn() }));
const csrf = vi.hoisted(() => ({ validateCsrf: vi.fn() }));

vi.mock("@/lib/external-auth", () => external);
vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/external-provider-settings", () => providers);
vi.mock("@/lib/rate-limit", () => rate);
vi.mock("@/lib/settings", () => settings);
vi.mock("@/lib/csrf", () => csrf);
vi.mock("@/lib/request", () => ({ requestIp: () => "127.0.0.1", requestOriginMatchesApp: () => true }));

const context = { params: Promise.resolve({ provider: "oidc-asetho-link" }) };

describe("external account connection start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getCurrentSession.mockResolvedValue({ userId: "user_1" });
    providers.getExternalProviderConfig.mockResolvedValue({ key: "oidc-asetho-link", provider: "oidc", id: "asetho-link" });
    rate.checkRateLimit.mockResolvedValue({ allowed: true });
    settings.getSetting.mockResolvedValue(true);
    external.externalAuthorizationUrl.mockResolvedValue(new URL("https://auth.example.test/authorize?client_id=asetho-link&state=state"));
  });

  it("starts a new navigation after the POST so form-action self does not block the provider", async () => {
    const { POST } = await import("@/app/api/auth/external/[provider]/route");
    const request = new NextRequest("http://localhost:3000/api/auth/external/oidc-asetho-link", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/x-www-form-urlencoded" },
      body: "csrf=valid"
    });

    const response = await POST(request, context);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(html).toContain('http-equiv="refresh"');
    expect(html).toContain("https://auth.example.test/authorize?client_id=asetho-link&amp;state=state");
    expect(response.cookies.get("surls_external_auth")?.value).toBe("signed-pending-auth");
    expect(external.encodeExternalAuth).toHaveBeenCalledWith(expect.objectContaining({ userId: "user_1" }));
  });

  it("keeps ordinary sign-in as a direct provider redirect", async () => {
    const { GET } = await import("@/app/api/auth/external/[provider]/route");
    const response = await GET(new NextRequest("http://localhost:3000/api/auth/external/oidc-asetho-link"), context);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://auth.example.test/authorize?client_id=asetho-link&state=state");
    expect(external.encodeExternalAuth).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });

  it("rejects unsafe authorization URL schemes in the continuation page", async () => {
    external.externalAuthorizationUrl.mockResolvedValue(new URL("javascript:alert(1)"));
    const { POST } = await import("@/app/api/auth/external/[provider]/route");
    const response = await POST(new NextRequest("http://localhost:3000/api/auth/external/oidc-asetho-link", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/x-www-form-urlencoded" },
      body: "csrf=valid"
    }), context);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/admin/profile?error=");
    expect(response.cookies.get("surls_external_auth")).toBeUndefined();
  });
});
