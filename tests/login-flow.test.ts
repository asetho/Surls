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
  requestIp: vi.fn(),
  requestOriginMatchesApp: vi.fn()
}));
const settings = vi.hoisted(() => ({ getSetting: vi.fn() }));

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
  requestIp: requestSecurity.requestIp,
  requestIpHash: () => "ip-hash",
  requestOriginMatchesApp: requestSecurity.requestOriginMatchesApp
}));
vi.mock("@/lib/backup-codes", () => backupCodes);
vi.mock("@/lib/totp", () => totp);
vi.mock("@/lib/turnstile", () => turnstile);
vi.mock("@/lib/settings", () => settings);

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
    vi.useRealTimers();
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true, count: 1, resetAt: new Date("2026-06-11T16:15:00.000Z") });
    auth.createSession.mockResolvedValue({
      expiresAt: new Date("2026-06-18T16:00:00.000Z"),
      token: "session-token"
    });
    turnstile.verifyTurnstileChallenge.mockResolvedValue({ ok: true, skipped: true });
    requestSecurity.requestIp.mockReturnValue("127.0.0.1");
    requestSecurity.requestOriginMatchesApp.mockReturnValue(true);
    settings.getSetting.mockResolvedValue(true);
  });

  it("blocks password and pending 2FA login when local sign-in is disabled", async () => {
    settings.getSetting.mockResolvedValue(false);
    const { POST: login } = await import("@/app/api/auth/login/route");
    const { POST: secondFactor } = await import("@/app/api/auth/login/2fa/route");
    const first = await login(formRequest("/api/auth/login", loginForm({ email: "admin@example.com", password: "some-password" })));
    const second = await secondFactor(formRequest("/api/auth/login/2fa", loginForm({ code: "123456" })));
    expect(first.status).toBe(303);
    expect(second.status).toBe(303);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("allows external sign-in to finish existing TOTP when local sign-in is disabled", async () => {
    settings.getSetting.mockResolvedValue(false);
    const { POST } = await import("@/app/api/auth/login/2fa/route");
    prisma.user.findUnique.mockResolvedValue({
      backupCodes: [], email: "admin@example.com", id: "user_123",
      totpCredential: { enabled: true, secretEncrypted: "encrypted-secret" }
    });
    totp.verifyTotpCode.mockResolvedValue(true);
    const pending = encodePendingLogin({ email: "admin@example.com", nextPath: "/admin/links", purpose: "external_2fa", userId: "user_123" });
    const response = await POST(formRequest("/api/auth/login/2fa", loginForm({ code: "123456" }), `${PENDING_LOGIN_COOKIE}=${pending}`));
    expect(response.status).toBe(303);
    expect(auth.createSession).toHaveBeenCalledWith("user_123", expect.any(NextRequest));
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

  it.each([
    ["oversized email", `${"a".repeat(309)}@example.com`, "guess"],
    ["oversized raw email with trim padding", `${" ".repeat(321)}admin@example.com`, "guess"],
    ["email that expands during normalization", `${"İ".repeat(160)}@x.y`, "guess"],
    ["oversized password", "admin@example.com", "x".repeat(4_097)]
  ])("rejects %s before rate keys or password work", async (_label, email, submittedPassword) => {
    const { POST } = await import("@/app/api/auth/login/route");

    const response = await POST(formRequest("/api/auth/login", loginForm({ email, password: submittedPassword })));

    expect(response.headers.get("location")).toContain("Invalid+email+or+password");
    expect(rateLimit.checkRateLimit).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(password.verifyPassword).not.toHaveBeenCalled();
  });

  it("accepts email and password inputs at their length limits", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const email = `${"a".repeat(308)}@example.com`;
    const submittedPassword = "x".repeat(4_096);
    prisma.user.findUnique.mockResolvedValue(null);
    password.verifyPassword.mockResolvedValue(false);

    const response = await POST(formRequest("/api/auth/login", loginForm({ email, password: submittedPassword })));

    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith(`login:127.0.0.1:${email}`, 8, 15 * 60 * 1000);
    expect(password.verifyPassword).toHaveBeenCalledWith(expect.stringMatching(/^\$argon2id\$/), submittedPassword);
    expect(response.headers.get("location")).toContain("Invalid+email+or+password");
  });

  it("accepts browser-style URL-encoded login forms", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    prisma.user.findUnique.mockResolvedValue({
      email: "admin@example.com", id: "user_123", passwordHash: "hash", totpCredential: null
    });
    password.verifyPassword.mockResolvedValue(true);
    const body = new URLSearchParams({ csrf: getCsrfToken(), email: "admin@example.com", password: "correct password" });
    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      body,
      headers: { "content-type": "application/x-www-form-urlencoded", origin: "http://localhost:3000" },
      method: "POST"
    });

    const response = await POST(request);

    expect(response.headers.get("set-cookie")).toContain("surls_session");
    expect(auth.createSession).toHaveBeenCalledWith("user_123", request);
  });

  it.each([
    ["declared", "70000", "email=admin%40example.com&password=guess"],
    ["misreported", "1", `email=admin%40example.com&password=${"x".repeat(65 * 1024)}`]
  ])("rejects %s oversized login bodies before parsing or password work", async (_label, contentLength, body) => {
    const { POST } = await import("@/app/api/auth/login/route");
    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      body,
      headers: {
        "content-length": contentLength,
        "content-type": "application/x-www-form-urlencoded",
        origin: "http://localhost:3000"
      },
      method: "POST"
    });
    const parseForm = vi.spyOn(request, "formData");

    const response = await POST(request);

    expect(response.headers.get("location")).toContain("Invalid+email+or+password");
    expect(parseForm).not.toHaveBeenCalled();
    expect(rateLimit.checkRateLimit).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(password.verifyPassword).not.toHaveBeenCalled();
  });

  it("does not let unrelated unknown-source attempts lock out a valid login", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    requestSecurity.requestIp.mockReturnValue("unknown");
    prisma.user.findUnique.mockResolvedValue(null);
    password.verifyPassword.mockResolvedValue(false);
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true });

    for (let batch = 0; batch < 4; batch += 1) {
      await Promise.all(Array.from({ length: 4 }, (_, offset) => POST(formRequest("/api/auth/login", loginForm({
        email: `missing-${batch * 4 + offset}@example.com`,
        password: "guess"
      })))));
    }
    expect(password.verifyPassword).toHaveBeenCalledTimes(16);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(16);
    expect(rateLimit.checkRateLimit).not.toHaveBeenCalledWith("login:password-work:shared", 16, 10 * 1000);

    prisma.user.findUnique.mockResolvedValue({
      email: "admin@example.com", id: "user_123", passwordHash: "hash", totpCredential: null
    });
    password.verifyPassword.mockResolvedValue(true);
    const recovered = await POST(formRequest("/api/auth/login", loginForm({
      email: "admin@example.com", password: "correct password"
    })));
    expect(recovered.headers.get("set-cookie")).toContain("surls_session");
    expect(password.verifyPassword).toHaveBeenCalledTimes(17);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(17);
  });

  it("uses one public credential error for exhausted known and missing accounts at an unknown source IP", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    requestSecurity.requestIp.mockReturnValue("unknown");
    prisma.user.findUnique.mockImplementation(async ({ where }: { where: { email: string } }) =>
      where.email === "admin@example.com"
        ? { email: "admin@example.com", id: "user_123", passwordHash: "hash", totpCredential: null }
        : null
    );
    rateLimit.checkRateLimit.mockImplementation(async (key: string) => ({
      allowed: !key.startsWith("login:unknown:")
    }));

    const [known, missing] = await Promise.all([
      POST(formRequest("/api/auth/login", loginForm({ email: "admin@example.com", password: "guess" }))),
      POST(formRequest("/api/auth/login", loginForm({ email: "missing@example.com", password: "guess" })))
    ]);

    expect(known.headers.get("location")).toBe(missing.headers.get("location"));
    expect(known.headers.get("location")).toContain("Invalid+email+or+password");
    expect(password.verifyPassword).not.toHaveBeenCalled();
  });

  it("pads fast unknown-source per-email denials to the credential failure minimum", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    vi.useFakeTimers();
    try {
      requestSecurity.requestIp.mockReturnValue("unknown");
      prisma.user.findUnique.mockResolvedValue(null);
      let reachedBudget!: () => void;
      const budgetChecked = new Promise<void>((resolve) => { reachedBudget = resolve; });
      rateLimit.checkRateLimit.mockImplementation(async (key: string) => {
        if (key === "login:unknown:missing@example.com") reachedBudget();
        return { allowed: key !== "login:unknown:missing@example.com" };
      });
      let settled = false;
      const pending = POST(formRequest("/api/auth/login", loginForm({ email: "missing@example.com", password: "guess" })))
        .then((response) => { settled = true; return response; });

      await budgetChecked;
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(299);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const response = await pending;
      expect(response.headers.get("location")).toContain("Invalid+email+or+password");
      expect(password.verifyPassword).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses a separate source work budget when the client IP is known", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    requestSecurity.requestIp.mockReturnValue("203.0.113.7");
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: false });

    const response = await POST(formRequest("/api/auth/login", loginForm({ email: "admin@example.com", password: "guess" })));

    expect(rateLimit.checkRateLimit).toHaveBeenCalledExactlyOnceWith(
      "login:password-work:source:203.0.113.7", 48, 15 * 60 * 1000
    );
    expect(response.headers.get("location")).toContain("Too+many+login+attempts");
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(password.verifyPassword).not.toHaveBeenCalled();
  });

  it("caps concurrent password hashes and releases the slot after verification", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    prisma.user.findUnique.mockImplementation(async ({ where }: { where: { email: string } }) => ({
      email: where.email, id: where.email, passwordHash: "hash", totpCredential: null
    }));
    const finishVerification: Array<(value: boolean) => void> = [];
    password.verifyPassword.mockImplementation(() => new Promise<boolean>((resolve) => {
      finishVerification.push(resolve);
    }));

    const inFlight = Array.from({ length: 4 }, (_, attempt) => POST(formRequest("/api/auth/login", loginForm({
      email: `missing-${attempt}@example.com`, password: "guess"
    }))));
    await vi.waitFor(() => expect(password.verifyPassword).toHaveBeenCalledTimes(4));

    const blocked = await POST(formRequest("/api/auth/login", loginForm({ email: "fifth@example.com", password: "guess" })));
    expect(blocked.headers.get("location")).toContain("Invalid+email+or+password");
    expect(password.verifyPassword).toHaveBeenCalledTimes(4);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(4);

    finishVerification.forEach((finish) => finish(false));
    await Promise.all(inFlight);
    password.verifyPassword.mockResolvedValue(false);
    const next = await POST(formRequest("/api/auth/login", loginForm({ email: "next@example.com", password: "guess" })));
    expect(next.headers.get("location")).toContain("Invalid+email+or+password");
    expect(password.verifyPassword).toHaveBeenCalledTimes(5);
  });

  it("gives known and missing accounts the same padded response when password work is full", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    prisma.user.findUnique.mockImplementation(async ({ where }: { where: { email: string } }) =>
      where.email === "admin@example.com"
        ? { email: "admin@example.com", id: "user_123", passwordHash: "hash", totpCredential: null }
        : null
    );
    const finishDummy: Array<(value: boolean) => void> = [];
    password.verifyPassword.mockImplementation((hash: string) => hash === "hash"
      ? Promise.resolve(true)
      : new Promise<boolean>((resolve) => { finishDummy.push(resolve); }));

    const inFlightDummy = Array.from({ length: 4 }, (_, attempt) => POST(formRequest("/api/auth/login", loginForm({
      email: `missing-${attempt}@example.com`, password: "guess"
    }))));
    await vi.waitFor(() => expect(finishDummy).toHaveLength(4));

    vi.useFakeTimers();
    let missingSettled = false;
    let knownSettled = false;
    const missingPending = POST(formRequest("/api/auth/login", loginForm({ email: "missing-four@example.com", password: "guess" })))
      .then((response) => { missingSettled = true; return response; });
    const knownPending = POST(formRequest("/api/auth/login", loginForm({ email: "admin@example.com", password: "correct password" })))
      .then((response) => { knownSettled = true; return response; });
    await vi.advanceTimersByTimeAsync(299);
    expect(missingSettled).toBe(false);
    expect(knownSettled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const [fifth, valid] = await Promise.all([missingPending, knownPending]);
    vi.useRealTimers();
    expect(fifth.headers.get("location")).toBe(valid.headers.get("location"));
    expect(fifth.headers.get("location")).toContain("Invalid+email+or+password");
    expect(valid.headers.get("set-cookie")).toBeNull();
    expect(password.verifyPassword).toHaveBeenCalledTimes(4);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(4);

    finishDummy.forEach((finish) => finish(false));
    await Promise.all(inFlightDummy);
    const recovered = await POST(formRequest("/api/auth/login", loginForm({ email: "admin@example.com", password: "correct password" })));
    expect(recovered.headers.get("set-cookie")).toContain("surls_session");
    expect(password.verifyPassword).toHaveBeenCalledTimes(5);
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
