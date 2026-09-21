import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCsrfToken } from "@/lib/csrf";
import { encodePendingLogin, PENDING_LOGIN_COOKIE } from "@/lib/pending-login";

const prisma = vi.hoisted(() => ({
  backupCode: {
    update: vi.fn()
  },
  user: {
    findUnique: vi.fn()
  }
}));

const auth = vi.hoisted(() => ({
  createSession: vi.fn(),
  setSessionCookie: vi.fn((response: NextResponse, token: string, expiresAt: Date) => {
    response.cookies.set("surls_session", token, { expires: expiresAt, path: "/" });
  })
}));

const password = vi.hoisted(() => ({
  verifyPassword: vi.fn()
}));

const rateLimit = vi.hoisted(() => ({
  checkRateLimit: vi.fn()
}));

const audit = vi.hoisted(() => ({
  auditLog: vi.fn()
}));

const backupCodes = vi.hoisted(() => ({
  verifyBackupCode: vi.fn()
}));

const totp = vi.hoisted(() => ({
  verifyTotpCode: vi.fn()
}));

const turnstile = vi.hoisted(() => ({
  verifyTurnstileChallenge: vi.fn()
}));

const requestSecurity = vi.hoisted(() => ({
  requestOriginMatchesApp: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({
  createSession: auth.createSession,
  safeRedirectPath: (value: unknown, fallback = "/admin") => {
    const path = String(value ?? fallback);
    return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
  },
  setSessionCookie: auth.setSessionCookie
}));
vi.mock("@/lib/password", () => password);
vi.mock("@/lib/rate-limit", () => rateLimit);
vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/request", () => ({
  requestIp: () => "127.0.0.1",
  requestIpHash: () => "ip-hash",
  requestOriginMatchesApp: requestSecurity.requestOriginMatchesApp
}));
vi.mock("@/lib/backup-codes", () => backupCodes);
vi.mock("@/lib/totp", () => totp);
vi.mock("@/lib/turnstile", () => turnstile);

function formRequest(path: string, formData: FormData, cookie?: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    body: formData,
    headers: { origin: "http://localhost:3000", ...(cookie ? { cookie } : {}) },
    method: "POST"
  });
}

function loginForm(fields: Record<string, string>) {
  const formData = new FormData();
  formData.set("csrf", getCsrfToken());
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("admin login flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true, count: 1, resetAt: new Date("2026-06-11T16:15:00.000Z") });
    auth.createSession.mockResolvedValue({
      expiresAt: new Date("2026-06-18T16:00:00.000Z"),
      token: "session-token"
    });
    turnstile.verifyTurnstileChallenge.mockResolvedValue({ ok: true, skipped: true });
    requestSecurity.requestOriginMatchesApp.mockReturnValue(true);
  });

  it("rejects password login before credential checks when the Turnstile challenge fails", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    turnstile.verifyTurnstileChallenge.mockResolvedValue({ ok: false, reason: "missing" });

    const response = await POST(
      formRequest(
        "/api/auth/login",
        loginForm({ email: "admin@example.com", next: "/admin/links", password: "correct password" })
      )
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/admin?error=Complete+the+security+check+and+try+again.&next=%2Fadmin%2Flinks"
    );
    expect(rateLimit.checkRateLimit).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("redirects TOTP-enabled password logins to the second step without creating a session", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    prisma.user.findUnique.mockResolvedValue({
      email: "admin@example.com",
      id: "user_123",
      passwordHash: "hash",
      totpCredential: { enabled: true }
    });
    password.verifyPassword.mockResolvedValue(true);

    const response = await POST(
      formRequest(
        "/api/auth/login",
        loginForm({ email: "admin@example.com", next: "/admin/links", password: "correct password" })
      )
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/2fa");
    expect(response.headers.get("set-cookie")).toContain(PENDING_LOGIN_COOKIE);
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("creates a session immediately when TOTP is not enabled", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    prisma.user.findUnique.mockResolvedValue({
      email: "admin@example.com",
      id: "user_123",
      passwordHash: "hash",
      totpCredential: null
    });
    password.verifyPassword.mockResolvedValue(true);

    const response = await POST(
      formRequest(
        "/api/auth/login",
        loginForm({ email: "admin@example.com", next: "/admin/links", password: "correct password" })
      )
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/links");
    expect(auth.createSession).toHaveBeenCalledWith("user_123", expect.any(NextRequest));
    expect(response.headers.get("set-cookie")).toContain("surls_session");
  });

  it("accepts a pending login and consumes a valid backup code on the second step", async () => {
    const { POST } = await import("@/app/api/auth/login/2fa/route");
    prisma.user.findUnique.mockResolvedValue({
      backupCodes: [{ codeHash: "backup-hash", id: "backup_123" }],
      email: "admin@example.com",
      id: "user_123",
      totpCredential: { enabled: true, secretEncrypted: "encrypted-secret" }
    });
    backupCodes.verifyBackupCode.mockResolvedValue(true);
    const pendingLogin = encodePendingLogin({
      email: "admin@example.com",
      nextPath: "/admin/links",
      userId: "user_123"
    });

    const response = await POST(
      formRequest(
        "/api/auth/login/2fa",
        loginForm({ code: "ABCDE-FGHIJ", method: "backup" }),
        `${PENDING_LOGIN_COOKIE}=${pendingLogin}`
      )
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/links");
    expect(prisma.backupCode.update).toHaveBeenCalledWith({
      data: { usedAt: expect.any(Date) },
      where: { id: "backup_123" }
    });
    expect(auth.createSession).toHaveBeenCalledWith("user_123", expect.any(NextRequest));
    expect(response.headers.get("set-cookie")).toContain("surls_session");
  });

  it("rejects the second step when no pending login exists", async () => {
    const { POST } = await import("@/app/api/auth/login/2fa/route");

    const response = await POST(formRequest("/api/auth/login/2fa", loginForm({ code: "123456", method: "totp" })));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin?error=Sign+in+again+to+continue.");
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("performs password verification for an unknown account", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    prisma.user.findUnique.mockResolvedValue(null);
    password.verifyPassword.mockResolvedValue(false);

    await POST(formRequest("/api/auth/login", loginForm({ email: "missing@example.com", password: "guess" })));

    expect(password.verifyPassword).toHaveBeenCalledWith(expect.stringMatching(/^\$argon2id\$/), "guess");
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("rejects cross-origin login posts before reading credentials", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    requestSecurity.requestOriginMatchesApp.mockReturnValue(false);

    const response = await POST(formRequest("/api/auth/login", loginForm({ email: "admin@example.com", password: "guess" })));

    expect(response.status).toBe(303);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(password.verifyPassword).not.toHaveBeenCalled();
  });

  it("enforces a 2FA attempt budget independent of source IP", async () => {
    const { POST } = await import("@/app/api/auth/login/2fa/route");
    const pendingLogin = encodePendingLogin({ email: "admin@example.com", nextPath: "/admin", userId: "user_123" });
    rateLimit.checkRateLimit
      .mockResolvedValueOnce({ allowed: true })
      .mockResolvedValueOnce({ allowed: false });

    const response = await POST(
      formRequest(
        "/api/auth/login/2fa",
        loginForm({ code: "123456", method: "totp" }),
        `${PENDING_LOGIN_COOKIE}=${pendingLogin}`
      )
    );

    expect(response.status).toBe(303);
    expect(rateLimit.checkRateLimit).toHaveBeenNthCalledWith(2, "login-2fa:account:user_123", 8, 15 * 60 * 1000);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
