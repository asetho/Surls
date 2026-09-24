import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const external = vi.hoisted(() => ({
  decodeExternalAuth: vi.fn(), externalProfile: vi.fn(), externalProviderConfig: vi.fn(),
  isExternalProvider: vi.fn((value: string) => value === "google"),
  EXTERNAL_AUTH_COOKIE: "surls_external_auth",
  expiredExternalAuthCookieOptions: vi.fn(() => ({ path: "/api/auth/external", expires: new Date(0) }))
}));
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
const pendingLogin = vi.hoisted(() => ({
  encodePendingLogin: vi.fn(() => "signed-pending"),
  PENDING_LOGIN_COOKIE: "surls_pending_login",
  pendingLoginCookieOptions: vi.fn(() => ({ path: "/" }))
}));

vi.mock("@/lib/external-auth", () => external);
vi.mock("@/lib/external-identity", () => identity);
vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/rate-limit", () => rate);
vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/pending-login", () => pendingLogin);
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
    external.externalProviderConfig.mockReturnValue({ id: "client", secret: "secret" });
    external.decodeExternalAuth.mockReturnValue({ provider: "google", state: "valid-state", verifier: "verifier", nonce: "nonce", nextPath: "/admin/links", userId: null });
    external.externalProfile.mockResolvedValue({ subject: "subject", email: "user@example.com", emailVerified: true, name: null });
    identity.resolveExternalIdentity.mockResolvedValue("user_1");
    rate.checkRateLimit.mockResolvedValue({ allowed: true });
    audit.auditLog.mockResolvedValue(undefined);
    auth.createSession.mockResolvedValue({ token: "session", expiresAt: new Date("2026-10-01T00:00:00Z") });
    prisma.user.findUnique.mockResolvedValue({ email: "user@example.com", totpCredential: null });
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
    expect(identity.resolveExternalIdentity).toHaveBeenCalledWith("google", expect.objectContaining({ subject: "subject" }), null);
    expect(auth.createSession).toHaveBeenCalledWith("user_1", expect.any(NextRequest));
  });

  it("rejects replayed state", async () => {
    rate.checkRateLimit.mockResolvedValue({ allowed: false });
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    await GET(callback(), { params: Promise.resolve({ provider: "google" }) });
    expect(external.externalProfile).not.toHaveBeenCalled();
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("requires existing Surls TOTP before creating an external session", async () => {
    prisma.user.findUnique.mockResolvedValue({ email: "user@example.com", totpCredential: { enabled: true } });
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    const response = await GET(callback(), { params: Promise.resolve({ provider: "google" }) });
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/2fa");
    expect(pendingLogin.encodePendingLogin).toHaveBeenCalledWith({ email: "user@example.com", nextPath: "/admin/links", purpose: "external_2fa", userId: "user_1" });
    expect(auth.createSession).not.toHaveBeenCalled();
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
