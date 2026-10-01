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
const providers = vi.hoisted(() => ({ getExternalProviderConfig: vi.fn(), externalProviderKey: vi.fn(() => "linked-provider-key") }));
const prisma = vi.hoisted(() => ({ externalIdentity: { findFirst: vi.fn() }, $transaction: vi.fn() }));
const rate = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const settings = vi.hoisted(() => ({ getSetting: vi.fn() }));
const csrf = vi.hoisted(() => ({ validateCsrf: vi.fn() }));
const password = vi.hoisted(() => ({ verifyPassword: vi.fn() }));
const totp = vi.hoisted(() => ({ verifyTotpCode: vi.fn() }));
const backupProof = vi.hoisted(() => ({ matchingBackupCodeId: vi.fn(), consumeBackupCode: vi.fn() }));
const audit = vi.hoisted(() => ({ auditLog: vi.fn() }));
const mail = vi.hoisted(() => ({ profileEmailAvailable: vi.fn(), sendExternalConnectCode: vi.fn() }));
const connectCode = vi.hoisted(() => ({
  EXTERNAL_CONNECT_CODE_COOKIE: "surls_external_connect_code",
  externalConnectCodeCookieOptions: vi.fn(() => ({ path: "/api/auth/external", httpOnly: true, maxAge: 600 })),
  createExternalConnectCode: vi.fn(), decodeExternalConnectCode: vi.fn(), verifyExternalConnectCode: vi.fn()
}));

vi.mock("@/lib/external-auth", () => external);
vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/external-provider-settings", () => providers);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/rate-limit", () => rate);
vi.mock("@/lib/settings", () => settings);
vi.mock("@/lib/csrf", () => csrf);
vi.mock("@/lib/password", () => password);
vi.mock("@/lib/totp", () => totp);
vi.mock("@/lib/backup-code-proof", () => backupProof);
vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/profile-email", () => mail);
vi.mock("@/lib/external-connect-code", () => connectCode);
vi.mock("@/lib/request", () => ({ requestIp: () => "127.0.0.1", requestOriginMatchesApp: () => true }));

const context = { params: Promise.resolve({ provider: "oidc-asetho-link" }) };

function post(body: string, provider = "oidc-asetho-link", cookie?: string) {
  return new NextRequest(`http://localhost:3000/api/auth/external/${provider}`, {
    method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/x-www-form-urlencoded", ...(cookie ? { cookie } : {}) }, body
  });
}

describe("external account connection start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getCurrentSession.mockResolvedValue({ id: "session_1", userId: "user_1", createdAt: new Date("2026-09-25T12:00:00Z"),
      user: { email: "user@example.com", passwordHash: "password-hash", totpCredential: null } });
    providers.getExternalProviderConfig.mockResolvedValue({ key: "oidc-asetho-link", provider: "oidc", id: "asetho-link" });
    rate.checkRateLimit.mockResolvedValue({ allowed: true });
    settings.getSetting.mockResolvedValue(true);
    external.externalAuthorizationUrl.mockResolvedValue(new URL("https://auth.example.test/authorize?client_id=asetho-link&state=state"));
    prisma.externalIdentity.findFirst.mockResolvedValue({ id: "identity_1" });
    password.verifyPassword.mockResolvedValue(true);
    totp.verifyTotpCode.mockResolvedValue(true);
    backupProof.matchingBackupCodeId.mockResolvedValue(null);
    backupProof.consumeBackupCode.mockResolvedValue(true);
    mail.profileEmailAvailable.mockResolvedValue(true);
    mail.sendExternalConnectCode.mockResolvedValue(undefined);
    connectCode.createExternalConnectCode.mockReturnValue({ code: "123456", cookie: "signed-code" });
    connectCode.decodeExternalConnectCode.mockReturnValue(null);
    connectCode.verifyExternalConnectCode.mockReturnValue(false);
  });

  it("rejects a session-only or unknown-purpose connection before OAuth", async () => {
    const { POST } = await import("@/app/api/auth/external/[provider]/route");
    for (const body of ["csrf=valid", "csrf=valid&purpose=other", "csrf=valid&purpose=connect"]) {
      const response = await POST(post(body), context);
      expect(response.headers.get("location")).toContain("/admin/profile?error=");
    }
    expect(external.externalAuthorizationUrl).not.toHaveBeenCalled();
  });

  it("starts a new navigation after a password proof and binds Connect to this session", async () => {
    const { POST } = await import("@/app/api/auth/external/[provider]/route");
    const response = await POST(post("csrf=valid&purpose=connect&method=password&password=known-secret"), context);
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
    expect(password.verifyPassword).toHaveBeenCalledWith("password-hash", "known-secret");
    expect(external.encodeExternalAuth).toHaveBeenCalledWith(expect.objectContaining({ purpose: "connect", userId: "user_1", sessionId: "session_1", provider: "oidc-asetho-link" }));
  });

  it("rejects a wrong password and never starts OAuth", async () => {
    password.verifyPassword.mockResolvedValue(false);
    const { POST } = await import("@/app/api/auth/external/[provider]/route");
    const response = await POST(post("csrf=valid&purpose=connect&method=password&password=wrong"), context);
    expect(response.headers.get("location")).toContain("/admin/profile?error=");
    expect(external.externalAuthorizationUrl).not.toHaveBeenCalled();
  });

  it("rejects oversized passwords before expensive verification", async () => {
    const { POST } = await import("@/app/api/auth/external/[provider]/route");
    const response = await POST(post(`csrf=valid&purpose=connect&method=password&password=${"x".repeat(4097)}`), context);
    expect(response.headers.get("location")).toContain("/admin/profile?error=");
    expect(password.verifyPassword).not.toHaveBeenCalled();
    expect(external.externalAuthorizationUrl).not.toHaveBeenCalled();
  });

  it("uses only a TOTP factor established before the session when TOTP is enabled", async () => {
    const session = await auth.getCurrentSession();
    session.user.totpCredential = { enabled: true, secretEncrypted: "secret", enabledAt: new Date("2026-09-24T12:00:00Z") };
    const { POST } = await import("@/app/api/auth/external/[provider]/route");
    expect((await POST(post("csrf=valid&purpose=connect&method=password&password=known-secret"), context)).status).toBe(303);
    expect(password.verifyPassword).not.toHaveBeenCalled();
    const response = await POST(post("csrf=valid&purpose=connect&method=totp&code=123456"), context);
    expect(response.status).toBe(200);
    expect(totp.verifyTotpCode).toHaveBeenCalledWith("secret", "123456");
    session.user.totpCredential.enabledAt = new Date("2026-09-25T12:01:00Z");
    expect((await POST(post("csrf=valid&purpose=connect&method=totp&code=123456"), context)).status).toBe(303);
  });

  it("consumes a saved backup code once before connecting a provider", async () => {
    const session = await auth.getCurrentSession();
    session.user.totpCredential = { id: "totp_1", enabled: true, secretEncrypted: "secret", enabledAt: new Date("2026-09-24T12:00:00Z") };
    backupProof.matchingBackupCodeId.mockResolvedValue("backup_1");
    const tx = {
      $queryRaw: vi.fn(async (parts: TemplateStringsArray) => String(parts[0]).includes('"Session"')
        ? [{ createdAt: new Date("2026-09-25T12:00:00Z"), expiresAt: new Date(Date.now() + 60_000) }]
        : [{ id: "user_1" }]),
      totpCredential: { findUnique: vi.fn(async () => session.user.totpCredential) }
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const { POST } = await import("@/app/api/auth/external/[provider]/route");
    const request = () => post("csrf=valid&purpose=connect&method=backup&code=ABCDE-FGHJK");
    expect((await POST(request(), context)).status).toBe(200);
    expect(backupProof.consumeBackupCode).toHaveBeenCalledWith(tx, "user_1", "backup_1");
    expect(audit.auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "BACKUP_CODE_USED" }));
    backupProof.consumeBackupCode.mockResolvedValueOnce(false);
    expect((await POST(request(), context)).status).toBe(303);
  });

  it("sends a target-bound current-email code and consumes it once", async () => {
    const { POST } = await import("@/app/api/auth/external/[provider]/route");
    const sent = await POST(post("csrf=valid&purpose=send-connect-code"), context);
    expect(sent.status).toBe(200);
    expect(mail.sendExternalConnectCode).toHaveBeenCalledWith("user@example.com", "123456");
    expect(connectCode.createExternalConnectCode).toHaveBeenCalledWith("user_1", "session_1", "user@example.com", "oidc-asetho-link");
    expect(sent.cookies.get("surls_external_connect_code")?.value).toBe("signed-code");
    connectCode.decodeExternalConnectCode.mockReturnValue({ userId: "user_1", sessionId: "session_1", currentEmail: "user@example.com",
      targetProvider: "wrong-provider", nonce: "nonce" });
    connectCode.verifyExternalConnectCode.mockReturnValue(true);
    const request = () => post("csrf=valid&purpose=connect&method=email&code=123456&password=known-secret", "oidc-asetho-link", "surls_external_connect_code=signed-code");
    expect((await POST(request(), context)).status).toBe(303);
    expect(external.externalAuthorizationUrl).not.toHaveBeenCalled();
    connectCode.decodeExternalConnectCode.mockReturnValue({ userId: "user_1", sessionId: "other_session", currentEmail: "user@example.com",
      targetProvider: "oidc-asetho-link", nonce: "nonce" });
    expect((await POST(request(), context)).status).toBe(303);
    expect(external.externalAuthorizationUrl).not.toHaveBeenCalled();
    connectCode.decodeExternalConnectCode.mockReturnValue({ userId: "user_1", sessionId: "session_1", currentEmail: "user@example.com",
      targetProvider: "oidc-asetho-link", nonce: "nonce" });
    expect((await POST(post("csrf=valid&purpose=connect&method=email&code=123456", "oidc-asetho-link", "surls_external_connect_code=signed-code"), context)).status).toBe(303);
    expect((await POST(request(), context)).status).toBe(200);
    expect(rate.checkRateLimit).toHaveBeenCalledWith(expect.stringContaining("external-connect:email-code:"), 1, 600_000);
    rate.checkRateLimit.mockImplementation(async (key: string) => ({ allowed: !key.startsWith("external-connect:email-code:") }));
    expect((await POST(request(), context)).status).toBe(303);
  });

  it("keeps ordinary sign-in as a direct provider redirect", async () => {
    const { GET } = await import("@/app/api/auth/external/[provider]/route");
    const response = await GET(new NextRequest("http://localhost:3000/api/auth/external/oidc-asetho-link"), context);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://auth.example.test/authorize?client_id=asetho-link&state=state");
    expect(external.encodeExternalAuth).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });

  it("requests fresh provider authentication for a one-time stale-session retry", async () => {
    const { beginExternalAuth } = await import("@/lib/external-auth-flow");
    const config = { key: "oidc-asetho-link", provider: "oidc" as const, id: "asetho-link" };
    const response = await beginExternalAuth(config as Parameters<typeof beginExternalAuth>[0], {
      userId: null, nextPath: "/admin/links", freshLoginAttempt: true
    });
    expect(response.status).toBe(303);
    expect(external.externalAuthorizationUrl).toHaveBeenCalledWith("oidc", "state", "verifier", "nonce", config, true);
    expect(external.encodeExternalAuth).toHaveBeenCalledWith(expect.objectContaining({
      userId: null, nextPath: "/admin/links", freshLoginAttempt: true
    }));
  });

  it("starts reauthentication only for a linked provider and binds it to this session", async () => {
    const { POST } = await import("@/app/api/auth/external/[provider]/route");
    const request = () => new NextRequest("http://localhost:3000/api/auth/external/oidc-asetho-link", {
      method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/x-www-form-urlencoded" },
      body: "csrf=valid&purpose=reauth&pendingEmail=new%40example.com"
    });
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(prisma.externalIdentity.findFirst).toHaveBeenCalledWith({ where: { userId: "user_1", provider: "linked-provider-key",
      createdAt: { lte: new Date("2026-09-25T12:00:00Z") } }, select: { id: true } });
    expect(external.externalAuthorizationUrl).toHaveBeenCalledWith("oidc", "state", "verifier", "nonce", expect.anything(), true);
    expect(external.encodeExternalAuth).toHaveBeenCalledWith(expect.objectContaining({ purpose: "reauth", sessionId: "session_1", userId: "user_1", pendingEmail: "new@example.com" }));
    prisma.externalIdentity.findFirst.mockResolvedValue(null);
    const rejected = await POST(request(), context);
    expect(rejected.headers.get("location")).toContain("/admin/profile?error=");
  });

  it("rejects a linked non-OIDC account as proof of fresh verification", async () => {
    password.verifyPassword.mockResolvedValue(false);
    providers.getExternalProviderConfig.mockImplementation(async (key: string) => key === "github" ? { key, provider: "github", id: "github-client" } :
      { key: "oidc-asetho-link", provider: "oidc", id: "asetho-link" });
    const { POST } = await import("@/app/api/auth/external/[provider]/route");
    const response = await POST(post("csrf=valid&purpose=verify-connect&targetProvider=oidc-asetho-link", "github"),
      { params: Promise.resolve({ provider: "github" }) });
    expect(response.status).toBe(303);
    expect(external.encodeExternalAuth).not.toHaveBeenCalled();
  });

  it("starts distinct TOTP setup proof only from a fresh-capable provider linked before the session", async () => {
    providers.getExternalProviderConfig.mockImplementation(async (key: string) => key === "github"
      ? { key, provider: "github", id: "github-client" }
      : { key: "oidc-asetho-link", provider: "oidc", id: "asetho-link" });
    const { POST } = await import("@/app/api/auth/external/[provider]/route");
    const response = await POST(post("csrf=valid&purpose=verify-totp-setup"), context);
    expect(response.status).toBe(200);
    expect(prisma.externalIdentity.findFirst).toHaveBeenCalledWith({ where: { userId: "user_1", provider: "linked-provider-key",
      createdAt: { lte: new Date("2026-09-25T12:00:00Z") } }, select: { id: true } });
    expect(external.encodeExternalAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: "oidc-asetho-link", purpose: "verify-totp-setup", userId: "user_1", sessionId: "session_1" }));
    prisma.externalIdentity.findFirst.mockResolvedValue(null);
    expect((await POST(post("csrf=valid&purpose=verify-totp-setup"), context)).status).toBe(303);
    prisma.externalIdentity.findFirst.mockResolvedValue({ id: "identity_1" });
    const session = await auth.getCurrentSession();
    session.user.totpCredential = { enabled: true };
    expect((await POST(post("csrf=valid&purpose=verify-totp-setup"), context)).status).toBe(303);
    session.user.totpCredential = null;
    expect((await POST(post("csrf=valid&purpose=verify-totp-setup", "github"),
      { params: Promise.resolve({ provider: "github" }) })).status).toBe(303);
  });

  it("rejects unsafe authorization URL schemes in the continuation page", async () => {
    external.externalAuthorizationUrl.mockResolvedValue(new URL("javascript:alert(1)"));
    const { POST } = await import("@/app/api/auth/external/[provider]/route");
    const response = await POST(post("csrf=valid&purpose=connect&method=password&password=known-secret"), context);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/admin/profile?error=");
    expect(response.cookies.get("surls_external_auth")).toBeUndefined();
  });
});
