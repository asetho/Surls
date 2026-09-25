import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const external = vi.hoisted(() => ({
  decodeExternalAuth: vi.fn(), externalProfile: vi.fn(),
  isExternalProvider: vi.fn((value: string) => value === "google"),
  EXTERNAL_AUTH_COOKIE: "surls_external_auth",
  expiredExternalAuthCookieOptions: vi.fn(() => ({ path: "/api/auth/external", expires: new Date(0) }))
}));
const providers = vi.hoisted(() => ({ getExternalProviderConfig: vi.fn() }));
const settings = vi.hoisted(() => ({ getSetting: vi.fn() }));
const identity = vi.hoisted(() => ({
  resolveExternalIdentity: vi.fn(),
  ExternalIdentityError: class ExternalIdentityError extends Error {}
}));
const auth = vi.hoisted(() => ({
  createSession: vi.fn(), getCurrentSession: vi.fn(),
  setSessionCookie: vi.fn((response: NextResponse, token: string) => response.cookies.set("surls_session", token))
}));
const rate = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const audit = vi.hoisted(() => ({ auditLog: vi.fn() }));
const prisma = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));

vi.mock("@/lib/external-auth", () => external);
vi.mock("@/lib/external-provider-settings", () => providers);
vi.mock("@/lib/settings", () => settings);
vi.mock("@/lib/external-identity", () => identity);
vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/rate-limit", () => rate);
vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/crypto", () => ({ hashToken: () => "state-hash" }));
vi.mock("@/lib/request", () => ({ requestIpHash: () => "ip-hash" }));

function callback(state = "valid-state") {
  return new NextRequest(`http://localhost:3000/api/auth/external/google/callback?code=one-time-code&state=${state}`, {
    headers: { cookie: "surls_external_auth=pending" }
  });
}

describe("external sign-in callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings.getSetting.mockResolvedValue(true);
    providers.getExternalProviderConfig.mockResolvedValue({ provider: "google", id: "client", secret: "secret", label: "Google", issuer: null, tenantId: null, source: "settings" });
    external.decodeExternalAuth.mockReturnValue({ provider: "google", state: "valid-state", verifier: "verifier", nonce: "nonce", nextPath: "/admin/links", userId: null });
    external.externalProfile.mockResolvedValue({ subject: "subject", email: "user@example.com", emailVerified: true, name: null });
    identity.resolveExternalIdentity.mockResolvedValue("user_1");
    rate.checkRateLimit.mockResolvedValue({ allowed: true });
    audit.auditLog.mockResolvedValue(undefined);
    auth.createSession.mockResolvedValue({ token: "session", expiresAt: new Date("2026-10-01T00:00:00Z") });
    prisma.user.findUnique.mockResolvedValue({ id: "user_1" });
  });

  it("rejects a mismatched state before token exchange", async () => {
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    const response = await GET(callback("wrong"), { params: Promise.resolve({ provider: "google" }) });
    expect(response.status).toBe(303);
    expect(external.externalProfile).not.toHaveBeenCalled();
    expect(auth.createSession).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain("surls_external_auth=");
  });

  it("creates a Surls session only after a verified provider identity resolves", async () => {
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    const response = await GET(callback(), { params: Promise.resolve({ provider: "google" }) });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/links");
    expect(identity.resolveExternalIdentity).toHaveBeenCalledWith(expect.objectContaining({ provider: "google" }), expect.objectContaining({ subject: "subject" }), null);
    expect(auth.createSession).toHaveBeenCalledWith("user_1", expect.any(NextRequest));
  });

  it("accepts a separate provider profile callback without changing its provider type", async () => {
    const key = "google--11111111-1111-4111-8111-111111111111";
    providers.getExternalProviderConfig.mockResolvedValue({ key, provider: "google", id: "second-client", secret: "secret" });
    external.decodeExternalAuth.mockReturnValue({ provider: key, state: "valid-state", verifier: "verifier", nonce: "nonce", nextPath: "/admin/links", userId: null });
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    const response = await GET(callback(), { params: Promise.resolve({ provider: key }) });
    expect(providers.getExternalProviderConfig).toHaveBeenCalledWith(key);
    expect(external.externalProfile).toHaveBeenCalledWith("google", expect.any(URL), expect.objectContaining({ provider: key }), expect.objectContaining({ key }));
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/links");
  });

  it("rejects replayed state", async () => {
    rate.checkRateLimit.mockResolvedValue({ allowed: false });
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    await GET(callback(), { params: Promise.resolve({ provider: "google" }) });
    expect(external.externalProfile).not.toHaveBeenCalled();
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("rejects a pending callback after external sign-in is disabled", async () => {
    settings.getSetting.mockResolvedValue(false);
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    const response = await GET(callback(), { params: Promise.resolve({ provider: "google" }) });
    expect(response.status).toBe(303);
    expect(external.externalProfile).not.toHaveBeenCalled();
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("does not require Surls TOTP after authenticated external sign-in", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user_1", totpCredential: { enabled: true } });
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    const response = await GET(callback(), { params: Promise.resolve({ provider: "google" }) });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: "user_1" }, select: { id: true } });
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/links");
    expect(auth.createSession).toHaveBeenCalledWith("user_1", expect.any(NextRequest));
    expect(response.headers.get("set-cookie")).toContain("surls_session");
  });

  it("binds profile connection to the initiating Surls user", async () => {
    external.decodeExternalAuth.mockReturnValue({ provider: "google", state: "valid-state", verifier: "verifier", nonce: "nonce", nextPath: "/admin/profile", userId: "user_1" });
    auth.getCurrentSession.mockResolvedValue({ userId: "other_user" });
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    await GET(callback(), { params: Promise.resolve({ provider: "google" }) });
    expect(identity.resolveExternalIdentity).not.toHaveBeenCalled();
    expect(auth.createSession).not.toHaveBeenCalled();
  });
});
