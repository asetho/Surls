import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodePasskeyChallenge, PASSKEY_AUTHENTICATION_COOKIE } from "@/lib/passkeys";
import { hashToken } from "@/lib/crypto";

const webauthn = vi.hoisted(() => ({ verifyAuthenticationResponse: vi.fn() }));
const prisma = vi.hoisted(() => ({ passkey: { findUnique: vi.fn(), update: vi.fn() } }));
const auth = vi.hoisted(() => ({
  createSession: vi.fn(),
  setSessionCookie: vi.fn((response: NextResponse, token: string) => response.cookies.set("surls_session", token))
}));
const rateLimit = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const audit = vi.hoisted(() => ({ auditLog: vi.fn() }));
const settings = vi.hoisted(() => ({ getSetting: vi.fn() }));
const requestIp = vi.hoisted(() => vi.fn());

vi.mock("@simplewebauthn/server", () => webauthn);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/rate-limit", () => rateLimit);
vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/settings", () => settings);
vi.mock("@/lib/request", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/request")>(),
  requestIp,
  requestIpHash: () => "ip-hash"
}));

function request(challenge = "challenge-123", body = JSON.stringify({ response: { id: "credential-123" } })) {
  return new NextRequest("http://localhost:3000/api/auth/passkey/auth/verify", {
    body,
    headers: {
      "content-type": "application/json",
      ...(challenge ? { cookie: `${PASSKEY_AUTHENTICATION_COOKIE}=${encodePasskeyChallenge({ challenge, purpose: "authentication" })}` } : {})
    },
    method: "POST"
  });
}

describe("POST /api/auth/passkey/auth/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestIp.mockReturnValue("unknown");
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true });
    audit.auditLog.mockResolvedValue(undefined);
    prisma.passkey.findUnique.mockResolvedValue({
      backedUp: true,
      counter: 0n,
      credentialId: "credential-123",
      id: "passkey-123",
      publicKey: "AA",
      transports: null,
      user: { id: "user-123" },
      userId: "user-123"
    });
    webauthn.verifyAuthenticationResponse.mockResolvedValue({
      authenticationInfo: { credentialBackedUp: true, newCounter: 0 },
      verified: true
    });
    auth.createSession.mockResolvedValue({ expiresAt: new Date("2026-09-20T00:00:00Z"), token: "session-token" });
    settings.getSetting.mockResolvedValue(true);
  });

  it("rejects passkey verification before reading credentials when local sign-in is disabled", async () => {
    settings.getSetting.mockResolvedValue(false);
    const { POST } = await import("@/app/api/auth/passkey/auth/verify/route");
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(prisma.passkey.findUnique).not.toHaveBeenCalled();
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("atomically accepts a challenge once and rejects a replay", async () => {
    const { POST } = await import("@/app/api/auth/passkey/auth/verify/route");
    let challengeUses = 0;
    rateLimit.checkRateLimit.mockImplementation(async (key: string) => ({
      allowed: key.startsWith("passkey:authentication-challenge:") ? ++challengeUses === 1 : true
    }));

    const first = await POST(request());
    const replay = await POST(request());

    expect(first.status).toBe(200);
    expect(replay.status).toBe(401);
    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith(`passkey:authentication-challenge:${hashToken("challenge-123")}`, 1, 600_000);
    expect(prisma.passkey.update).toHaveBeenCalledTimes(1);
    expect(auth.createSession).toHaveBeenCalledTimes(1);
  });

  it("isolates malformed traffic and exhausted challenge budgets from unrelated users", async () => {
    const { POST } = await import("@/app/api/auth/passkey/auth/verify/route");
    rateLimit.checkRateLimit.mockImplementation(async (key: string) => ({
      allowed: !key.includes(":unknown") && key !== `passkey:attempt:${hashToken("attacker")}`
    }));
    expect((await POST(request("", "not JSON"))).status).toBe(429);
    expect((await POST(request("attacker"))).status).toBe(429);
    expect((await POST(request("legitimate"))).status).toBe(200);
    expect(prisma.passkey.findUnique).toHaveBeenCalledTimes(1);
    expect(audit.auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "LOGIN_SUCCESS" }));
    expect(rateLimit.checkRateLimit.mock.calls.some(([key]) => key === "passkey:verify:unknown")).toBe(false);
  });

  it("retains known-IP throttling and validates bounded payloads before credential lookup", async () => {
    const { POST } = await import("@/app/api/auth/passkey/auth/verify/route");
    requestIp.mockReturnValue("8.8.8.8");
    rateLimit.checkRateLimit.mockResolvedValueOnce({ allowed: false });
    expect((await POST(request())).status).toBe(429);
    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith("passkey:verify:8.8.8.8", 30, 900_000);
    requestIp.mockReturnValue("unknown");
    for (const body of ["null", "not JSON", '{"response":{"id":{"not":"a string"}}}']) {
      expect((await POST(request("valid", body))).status).toBe(400);
    }
    expect((await POST(request("valid", JSON.stringify({ response: { id: "a".repeat(70_000) } })))).status).toBe(413);
    expect(prisma.passkey.findUnique).not.toHaveBeenCalled();
  });

  it("releases verification capacity after both successful and failed requests", async () => {
    const { POST } = await import("@/app/api/auth/passkey/auth/verify/route");
    let unblock!: () => void;
    const pending = new Promise<void>((resolve) => { unblock = resolve; });
    webauthn.verifyAuthenticationResponse.mockImplementation(async () => {
      await pending;
      throw new Error("invalid assertion");
    });
    const requests = Array.from({ length: 8 }, (_, index) => POST(request(`pending-${index}`)));
    await vi.waitFor(() => expect(webauthn.verifyAuthenticationResponse).toHaveBeenCalledTimes(8));
    try {
      expect((await POST(request("overflow"))).status).toBe(429);
    } finally {
      unblock();
      expect((await Promise.all(requests)).every((response) => response.status === 401)).toBe(true);
    }
    webauthn.verifyAuthenticationResponse.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 0, credentialBackedUp: true } });
    expect((await POST(request("after-failure"))).status).toBe(200);
    expect((await POST(request("after-success"))).status).toBe(200);
  });
});
