import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const webauthn = vi.hoisted(() => ({ verifyAuthenticationResponse: vi.fn() }));
const prisma = vi.hoisted(() => ({ passkey: { findUnique: vi.fn(), update: vi.fn() } }));
const auth = vi.hoisted(() => ({
  createSession: vi.fn(),
  setSessionCookie: vi.fn((response: NextResponse, token: string) => response.cookies.set("surls_session", token))
}));
const rateLimit = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const audit = vi.hoisted(() => ({ auditLog: vi.fn() }));

vi.mock("@simplewebauthn/server", () => webauthn);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/rate-limit", () => rateLimit);
vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/crypto", () => ({ hashToken: () => "challenge-hash" }));
vi.mock("@/lib/request", () => ({ requestIp: () => "127.0.0.1", requestIpHash: () => "ip-hash" }));
vi.mock("@/lib/passkeys", () => ({
  decodePasskeyChallenge: () => ({ challenge: "challenge-123", issuedAt: Date.now(), purpose: "authentication" }),
  expiredPasskeyCookieOptions: () => ({ expires: new Date(0), path: "/" }),
  PASSKEY_AUTHENTICATION_COOKIE: "surls_passkey_authentication",
  PASSKEY_CHALLENGE_MAX_AGE_SECONDS: 300,
  passkeyToWebAuthnCredential: () => ({ id: "credential-123", publicKey: new Uint8Array(), counter: 0 })
}));

function request() {
  return new NextRequest("http://localhost:3000/api/auth/passkey/auth/verify", {
    body: JSON.stringify({ response: { id: "credential-123" } }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
}

describe("POST /api/auth/passkey/auth/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith("passkey:authentication-challenge:challenge-hash", 1, 600_000);
    expect(prisma.passkey.update).toHaveBeenCalledTimes(1);
    expect(auth.createSession).toHaveBeenCalledTimes(1);
  });
});
