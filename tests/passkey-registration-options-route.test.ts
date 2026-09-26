import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
const password = vi.hoisted(() => ({ verifyPassword: vi.fn() }));
const rateLimit = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const webauthn = vi.hoisted(() => ({ generateRegistrationOptions: vi.fn() }));
const passkeys = vi.hoisted(() => ({
  cleanPasskeyName: vi.fn((value: unknown) => String(value || "Passkey")),
  encodePasskeyChallenge: vi.fn(() => "signed-challenge"),
  PASSKEY_REGISTRATION_COOKIE: "surls_passkey_registration",
  passkeyCookieOptions: vi.fn(() => ({ httpOnly: true })),
  parsePasskeyTransports: vi.fn()
}));
const prisma = vi.hoisted(() => ({ passkey: { findMany: vi.fn() } }));
const settings = vi.hoisted(() => ({ getSetting: vi.fn() }));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/csrf", () => ({ validateCsrfValue: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { APP_NAME: "Surls", WEBAUTHN_RP_ID: "surls.example" } }));
vi.mock("@/lib/password", () => password);
vi.mock("@/lib/rate-limit", () => rateLimit);
vi.mock("@/lib/request", () => ({
  requestIp: () => "127.0.0.1",
  requestOriginMatchesApp: (request: NextRequest) => request.headers.get("origin") === "http://localhost:3000"
}));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/settings", () => settings);
vi.mock("@/lib/passkeys", () => passkeys);
vi.mock("@simplewebauthn/server", () => webauthn);

function request(body: Record<string, unknown>, origin: string | null = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/auth/passkey/register/options", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...(origin === null ? {} : { origin }) },
    method: "POST"
  });
}

describe("POST /api/auth/passkey/register/options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAdmin.mockResolvedValue({ email: "admin@example.com", id: "user_123", name: null, passwordHash: "hash" });
    password.verifyPassword.mockResolvedValue(true);
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true });
    prisma.passkey.findMany.mockResolvedValue([]);
    webauthn.generateRegistrationOptions.mockResolvedValue({ challenge: "registration-challenge" });
    settings.getSetting.mockResolvedValue(true);
  });

  it("blocks passkey registration when local sign-in is disabled", async () => {
    settings.getSetting.mockResolvedValue(false);
    const { POST } = await import("@/app/api/auth/passkey/register/options/route");
    const response = await POST(request({ csrf: "csrf", name: "Laptop", password: "correct" }));
    expect(response.status).toBe(403);
    expect(webauthn.generateRegistrationOptions).not.toHaveBeenCalled();
  });

  it("rejects a stolen session that cannot prove the current password", async () => {
    password.verifyPassword.mockResolvedValue(false);
    const { POST } = await import("@/app/api/auth/passkey/register/options/route");

    const response = await POST(request({ csrf: "csrf", name: "Attacker device", password: "wrong" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Re-enter your password to add a passkey." });
    expect(webauthn.generateRegistrationOptions).not.toHaveBeenCalled();
    expect(prisma.passkey.findMany).not.toHaveBeenCalled();
  });

  it.each([null, "https://other.example.test"])("rejects an invalid request origin before checking the password: %s", async (origin) => {
    const { POST } = await import("@/app/api/auth/passkey/register/options/route");

    const response = await POST(request({ csrf: "csrf", name: "Attacker device", password: "correct" }, origin));

    expect(response.status).toBe(403);
    expect(password.verifyPassword).not.toHaveBeenCalled();
    expect(webauthn.generateRegistrationOptions).not.toHaveBeenCalled();
  });

  it("binds a fresh registration challenge to a verified account password", async () => {
    const { POST } = await import("@/app/api/auth/passkey/register/options/route");

    const response = await POST(request({ csrf: "csrf", name: "Laptop", password: "correct" }));

    expect(response.status).toBe(200);
    expect(password.verifyPassword).toHaveBeenCalledWith("hash", "correct");
    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith("passkey:registration:127.0.0.1:user_123", 8, 15 * 60 * 1000);
    expect(passkeys.encodePasskeyChallenge).toHaveBeenCalledWith({
      challenge: "registration-challenge",
      name: "Laptop",
      purpose: "registration",
      userId: "user_123"
    });
    expect(response.headers.get("set-cookie")).toContain("surls_passkey_registration=signed-challenge");
  });
});
