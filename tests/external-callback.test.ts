import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodePendingLogin, PENDING_LOGIN_COOKIE } from "@/lib/pending-login";

const external = vi.hoisted(() => ({
  decodeExternalAuth: vi.fn(), externalProfile: vi.fn(),
  isExternalProvider: vi.fn((value: string) => value === "google"),
  EXTERNAL_AUTH_COOKIE: "surls_external_auth",
  expiredExternalAuthCookieOptions: vi.fn(() => ({ path: "/api/auth/external", expires: new Date(0) }))
}));
const providers = vi.hoisted(() => ({ getExternalProviderConfig: vi.fn(), externalProviderKey: vi.fn(() => "linked-provider-key") }));
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
const prisma = vi.hoisted(() => ({ user: { findUnique: vi.fn() }, externalIdentity: { findUnique: vi.fn() } }));
const verification = vi.hoisted(() => ({
  PROFILE_VERIFICATION_COOKIE: "surls_profile_verification",
  encodeProfileVerification: vi.fn(() => "signed-proof"),
  profileVerificationCookieOptions: vi.fn(() => ({ path: "/admin/profile", httpOnly: true, maxAge: 300 }))
}));
const flow = vi.hoisted(() => ({ beginExternalAuth: vi.fn() }));
const totpSetupProof = vi.hoisted(() => ({
  TOTP_SETUP_PROOF_COOKIE: "surls_totp_setup_proof",
  encodeTotpSetupProof: vi.fn(() => "signed-totp-setup-proof"),
  totpSetupProofCookieOptions: vi.fn(() => ({ path: "/admin/profile", httpOnly: true, maxAge: 300 }))
}));

vi.mock("@/lib/external-auth", () => external);
vi.mock("@/lib/external-provider-settings", () => providers);
vi.mock("@/lib/settings", () => settings);
vi.mock("@/lib/external-identity", () => identity);
vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/rate-limit", () => rate);
vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/profile-verification", () => verification);
vi.mock("@/lib/external-auth-flow", () => flow);
vi.mock("@/lib/totp-setup-proof", () => totpSetupProof);
vi.mock("@/lib/crypto", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/crypto")>(), hashToken: () => "state-hash"
}));
vi.mock("@/lib/request", () => ({ requestIpHash: () => "ip-hash" }));

function callback(state = "valid-state", provider = "google") {
  return new NextRequest(`http://localhost:3000/api/auth/external/${provider}/callback?code=one-time-code&state=${state}`, {
    headers: { cookie: "surls_external_auth=pending" }
  });
}

describe("external sign-in callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings.getSetting.mockResolvedValue(true);
    providers.getExternalProviderConfig.mockResolvedValue({ provider: "google", id: "client", secret: "secret", label: "Google", issuer: null, tenantId: null, source: "settings" });
    external.decodeExternalAuth.mockReturnValue({ provider: "google", state: "valid-state", verifier: "verifier", nonce: "nonce", nextPath: "/admin/links", userId: null });
    external.externalProfile.mockResolvedValue({ subject: "subject", email: "user@example.com", emailVerified: true, name: null, mfaVerified: false });
    identity.resolveExternalIdentity.mockResolvedValue("user_1");
    rate.checkRateLimit.mockResolvedValue({ allowed: true });
    audit.auditLog.mockResolvedValue(undefined);
    auth.createSession.mockResolvedValue({ token: "session", expiresAt: new Date("2026-10-01T00:00:00Z") });
    prisma.user.findUnique.mockResolvedValue({ id: "user_1" });
    prisma.externalIdentity.findUnique.mockResolvedValue({ userId: "user_1", createdAt: new Date("2026-09-25T11:00:00Z") });
    flow.beginExternalAuth.mockImplementation(async () => {
      const response = new NextResponse("continuing connection", { status: 200 });
      response.cookies.set("surls_external_auth", "next-signed-state", { path: "/api/auth/external" });
      return response;
    });
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

  it.each([false, undefined, "true"])("requires enabled Surls TOTP when provider MFA is not confirmed (%s)", async (mfaVerified) => {
    external.externalProfile.mockResolvedValue({ subject: "subject", emailVerified: true, mfaVerified });
    prisma.user.findUnique.mockResolvedValue({ email: "user@example.com", totpCredential: { enabled: true } });
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    const response = await GET(callback(), { params: Promise.resolve({ provider: "google" }) });
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/2fa");
    const pending = response.cookies.get(PENDING_LOGIN_COOKIE);
    expect(decodePendingLogin(pending?.value)).toMatchObject({
      purpose: "external_2fa", userId: "user_1", email: "user@example.com", nextPath: "/admin/links"
    });
    expect(pending).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 300 });
    expect(auth.createSession).not.toHaveBeenCalled();
    expect(auth.setSessionCookie).not.toHaveBeenCalled();
    expect(audit.auditLog).not.toHaveBeenCalled();
  });

  it("accepts confirmed provider MFA without an additional Surls TOTP prompt", async () => {
    external.externalProfile.mockResolvedValue({ subject: "subject", emailVerified: true, mfaVerified: true });
    prisma.user.findUnique.mockResolvedValue({ email: "user@example.com", totpCredential: { enabled: true } });
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    const response = await GET(callback(), { params: Promise.resolve({ provider: "google" }) });
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/links");
    expect(auth.createSession).toHaveBeenCalledWith("user_1", expect.any(NextRequest));
    expect(response.headers.get("set-cookie")).toContain("surls_session");
    expect(response.cookies.get(PENDING_LOGIN_COOKIE)).toBeUndefined();
  });

  it("connects an identity to the existing session without creating a new session", async () => {
    external.decodeExternalAuth.mockReturnValue({ provider: "google", state: "valid-state", verifier: "verifier", nonce: "nonce", nextPath: "/admin/profile",
      userId: "user_1", sessionId: "session_1", purpose: "connect" });
    auth.getCurrentSession.mockResolvedValue({ userId: "user_1", id: "session_1" });
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    const response = await GET(callback(), { params: Promise.resolve({ provider: "google" }) });
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/profile?connected=1");
    expect(identity.resolveExternalIdentity).toHaveBeenCalledWith(expect.anything(), expect.anything(), "user_1");
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(auth.createSession).not.toHaveBeenCalled();
    expect(response.cookies.get(PENDING_LOGIN_COOKIE)).toBeUndefined();
  });

  it("binds profile connection to the initiating Surls user", async () => {
    external.decodeExternalAuth.mockReturnValue({ provider: "google", state: "valid-state", verifier: "verifier", nonce: "nonce", nextPath: "/admin/profile",
      userId: "user_1", sessionId: "session_1", purpose: "connect" });
    auth.getCurrentSession.mockResolvedValue({ userId: "other_user", id: "session_1" });
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    await GET(callback(), { params: Promise.resolve({ provider: "google" }) });
    expect(identity.resolveExternalIdentity).not.toHaveBeenCalled();
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("rejects legacy signed link state and a rotated session before provider exchange", async () => {
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    external.decodeExternalAuth.mockReturnValue({ provider: "google", state: "valid-state", verifier: "verifier", nonce: "nonce", nextPath: "/admin/profile", userId: "user_1" });
    auth.getCurrentSession.mockResolvedValue({ userId: "user_1", id: "session_1" });
    const legacy = await GET(callback(), { params: Promise.resolve({ provider: "google" }) });
    expect(legacy.headers.get("location")).toContain("/admin/profile?error=");
    expect(external.externalProfile).not.toHaveBeenCalled();
    expect(identity.resolveExternalIdentity).not.toHaveBeenCalled();
    external.decodeExternalAuth.mockReturnValue({ provider: "google", state: "valid-state", verifier: "verifier", nonce: "nonce", nextPath: "/admin/profile",
      userId: "user_1", sessionId: "session_1", purpose: "connect" });
    auth.getCurrentSession.mockResolvedValue({ userId: "user_1", id: "session_2" });
    const rotated = await GET(callback(), { params: Promise.resolve({ provider: "google" }) });
    expect(rotated.headers.get("location")).toContain("/admin/profile?error=");
    expect(external.externalProfile).not.toHaveBeenCalled();
    expect(identity.resolveExternalIdentity).not.toHaveBeenCalled();
  });

  it("rechecks the same session after provider exchange before creating the link", async () => {
    external.decodeExternalAuth.mockReturnValue({ provider: "google", state: "valid-state", verifier: "verifier", nonce: "nonce", nextPath: "/admin/profile",
      userId: "user_1", sessionId: "session_1", purpose: "connect" });
    auth.getCurrentSession.mockResolvedValueOnce({ userId: "user_1", id: "session_1" })
      .mockResolvedValueOnce({ userId: "user_1", id: "session_2" });
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    const response = await GET(callback(), { params: Promise.resolve({ provider: "google" }) });
    expect(response.headers.get("location")).toContain("/admin/profile?error=");
    expect(external.externalProfile).toHaveBeenCalledOnce();
    expect(identity.resolveExternalIdentity).not.toHaveBeenCalled();
  });

  it("rejects a linked GitHub identity without fresh authentication for Connect", async () => {
    external.decodeExternalAuth.mockReturnValue({ provider: "github", state: "valid-state", verifier: "verifier", nonce: "nonce",
      nextPath: "/admin/profile", userId: "user_1", purpose: "verify-connect", sessionId: "session_1", targetProvider: "google", issuedAt: Date.now() });
    providers.getExternalProviderConfig.mockImplementation(async (key: string) => key === "github" ? { key, provider: "github", id: "github-client" } :
      { key: "google", provider: "google", id: "google-client" });
    auth.getCurrentSession.mockResolvedValue({ id: "session_1", userId: "user_1", createdAt: new Date("2026-09-25T12:00:00Z") });
    external.externalProfile.mockResolvedValue({ subject: "subject", emailVerified: true, mfaVerified: false });
    prisma.user.findUnique.mockResolvedValue({ totpCredential: null });
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    const response = await GET(callback("valid-state", "github"), { params: Promise.resolve({ provider: "github" }) });
    expect(response.headers.get("location")).toContain("/admin/profile?error=");
    expect(flow.beginExternalAuth).not.toHaveBeenCalled();
    expect(identity.resolveExternalIdentity).not.toHaveBeenCalled();
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("rejects OIDC provider-backed Connect proof without fresh auth_time or required MFA", async () => {
    external.decodeExternalAuth.mockReturnValue({ provider: "google", state: "valid-state", verifier: "verifier", nonce: "nonce",
      nextPath: "/admin/profile", userId: "user_1", purpose: "verify-connect", sessionId: "session_1", targetProvider: "github", issuedAt: Date.now() });
    auth.getCurrentSession.mockResolvedValue({ id: "session_1", userId: "user_1", createdAt: new Date("2026-09-25T12:00:00Z") });
    prisma.user.findUnique.mockResolvedValue({ totpCredential: { enabled: true } });
    external.externalProfile.mockResolvedValue({ subject: "subject", mfaVerified: false, authenticatedAt: Math.floor(Date.now() / 1000) });
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    expect((await GET(callback(), { params: Promise.resolve({ provider: "google" }) })).headers.get("location")).toContain("/admin/profile?error=");
    expect(flow.beginExternalAuth).not.toHaveBeenCalled();
    external.externalProfile.mockResolvedValue({ subject: "subject", mfaVerified: true, authenticatedAt: null });
    expect((await GET(callback(), { params: Promise.resolve({ provider: "google" }) })).headers.get("location")).toContain("/admin/profile?error=");
    expect(flow.beginExternalAuth).not.toHaveBeenCalled();
  });

  it("rejects a linked GitHub session as TOTP setup verification", async () => {
    external.decodeExternalAuth.mockReturnValue({ provider: "github", state: "valid-state", verifier: "verifier", nonce: "nonce",
      nextPath: "/admin/profile", userId: "user_1", purpose: "verify-totp-setup", sessionId: "session_1", issuedAt: Date.now() });
    providers.getExternalProviderConfig.mockResolvedValue({ key: "github", provider: "github", id: "github-client" });
    auth.getCurrentSession.mockResolvedValue({ id: "session_1", userId: "user_1", createdAt: new Date("2026-09-25T12:00:00Z") });
    external.externalProfile.mockResolvedValue({ subject: "subject", mfaVerified: false });
    prisma.user.findUnique.mockResolvedValue({ totpCredential: null });
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    const response = await GET(callback("valid-state", "github"), { params: Promise.resolve({ provider: "github" }) });
    expect(response.headers.get("location")).toContain("/admin/profile?error=");
    expect(response.cookies.get("surls_totp_setup_proof")).toBeUndefined();
    expect(totpSetupProof.encodeTotpSetupProof).not.toHaveBeenCalled();
    expect(identity.resolveExternalIdentity).not.toHaveBeenCalled();
  });

  it("issues a TOTP setup grant after fresh linked OIDC verification", async () => {
    external.decodeExternalAuth.mockReturnValue({ provider: "google", state: "valid-state", verifier: "verifier", nonce: "nonce",
      nextPath: "/admin/profile", userId: "user_1", purpose: "verify-totp-setup", sessionId: "session_1", issuedAt: Date.now() });
    auth.getCurrentSession.mockResolvedValue({ id: "session_1", userId: "user_1", createdAt: new Date("2026-09-25T12:00:00Z") });
    external.externalProfile.mockResolvedValue({ subject: "subject", mfaVerified: false, authenticatedAt: Math.floor(Date.now() / 1000) });
    prisma.user.findUnique.mockResolvedValue({ totpCredential: null });
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    const response = await GET(callback(), { params: Promise.resolve({ provider: "google" }) });
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/profile?totpVerified=1");
    expect(response.cookies.get("surls_totp_setup_proof")?.value).toBe("signed-totp-setup-proof");
    expect(totpSetupProof.encodeTotpSetupProof).toHaveBeenCalledWith("user_1", "session_1");
  });

  it("cannot use provider proof to start TOTP setup when TOTP is already enabled", async () => {
    external.decodeExternalAuth.mockReturnValue({ provider: "google", state: "valid-state", verifier: "verifier", nonce: "nonce",
      nextPath: "/admin/profile", userId: "user_1", purpose: "verify-totp-setup", sessionId: "session_1", issuedAt: Date.now() });
    auth.getCurrentSession.mockResolvedValue({ id: "session_1", userId: "user_1", createdAt: new Date("2026-09-25T12:00:00Z") });
    external.externalProfile.mockResolvedValue({ subject: "subject", mfaVerified: true, authenticatedAt: Math.floor(Date.now() / 1000) });
    prisma.user.findUnique.mockResolvedValue({ totpCredential: { enabled: true } });
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    const response = await GET(callback(), { params: Promise.resolve({ provider: "google" }) });
    expect(response.headers.get("location")).toContain("/admin/profile?error=");
    expect(response.cookies.get("surls_totp_setup_proof")).toBeUndefined();
  });

  it("accepts fresh authentication from the same linked account and session", async () => {
    external.decodeExternalAuth.mockReturnValue({ provider: "google", state: "valid-state", verifier: "verifier", nonce: "nonce",
      nextPath: "/admin/profile", userId: "user_1", purpose: "reauth", sessionId: "session_1", pendingEmail: "new@example.com", issuedAt: Date.now() });
    auth.getCurrentSession.mockResolvedValue({ id: "session_1", userId: "user_1", createdAt: new Date("2026-09-25T12:00:00Z") });
    external.externalProfile.mockResolvedValue({ subject: "subject", authenticatedAt: Math.floor(Date.now() / 1000), mfaVerified: true });
    prisma.user.findUnique.mockResolvedValue({ totpCredential: { enabled: true } });
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    const response = await GET(callback(), { params: Promise.resolve({ provider: "google" }) });
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/profile?verified=1");
    expect(response.cookies.get("surls_profile_verification")?.value).toBe("signed-proof");
    expect(verification.encodeProfileVerification).toHaveBeenCalledWith("user_1", "session_1", "new@example.com");
    expect(identity.resolveExternalIdentity).not.toHaveBeenCalled();
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it.each(["stale", "wrong session", "wrong account", "missing MFA", "new connection"]) ("rejects reauthentication with %s", async (problem) => {
    external.decodeExternalAuth.mockReturnValue({ provider: "google", state: "valid-state", verifier: "verifier", nonce: "nonce",
      nextPath: "/admin/profile", userId: "user_1", purpose: "reauth", sessionId: "session_1", issuedAt: Date.now() });
    auth.getCurrentSession.mockResolvedValue({ id: problem === "wrong session" ? "session_2" : "session_1", userId: "user_1",
      createdAt: new Date("2026-09-25T12:00:00Z") });
    external.externalProfile.mockResolvedValue({ subject: "subject", authenticatedAt: Math.floor(Date.now() / 1000) - (problem === "stale" ? 3600 : 0),
      mfaVerified: problem !== "missing MFA" });
    prisma.externalIdentity.findUnique.mockResolvedValue({ userId: problem === "wrong account" ? "other_user" : "user_1",
      createdAt: new Date(problem === "new connection" ? "2026-09-25T13:00:00Z" : "2026-09-25T11:00:00Z") });
    prisma.user.findUnique.mockResolvedValue({ totpCredential: { enabled: true } });
    const { GET } = await import("@/app/api/auth/external/[provider]/callback/route");
    const response = await GET(callback(), { params: Promise.resolve({ provider: "google" }) });
    expect(response.headers.get("location")).toContain("/admin/profile?error=");
    expect(response.cookies.get("surls_profile_verification")).toBeUndefined();
    expect(auth.createSession).not.toHaveBeenCalled();
  });
});
