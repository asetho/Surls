import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodePasskeyChallenge, PASSKEY_REGISTRATION_COOKIE } from "@/lib/passkeys";

const auth = vi.hoisted(() => ({ getCurrentSession: vi.fn() }));
const csrf = vi.hoisted(() => ({ validateCsrfValue: vi.fn() }));
const prisma = vi.hoisted(() => ({ passkey: { create: vi.fn() } }));
const settings = vi.hoisted(() => ({ getSetting: vi.fn() }));
const webauthn = vi.hoisted(() => ({ verifyRegistrationResponse: vi.fn() }));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/csrf", () => csrf);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/settings", () => settings);
vi.mock("@simplewebauthn/server", () => webauthn);

import { POST } from "@/app/api/auth/passkey/register/verify/route";

function request(origin: string | null, cookie?: string) {
  return new NextRequest("http://localhost:3000/api/auth/passkey/register/verify", {
    method: "POST",
    body: JSON.stringify({ csrf: "valid-token", response: { id: "credential" } }),
    headers: { "content-type": "application/json", ...(origin === null ? {} : { origin }), ...(cookie ? { cookie } : {}) }
  });
}

describe("POST /api/auth/passkey/register/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getCurrentSession.mockResolvedValue({ id: "session_1", user: { id: "admin_1" } });
    settings.getSetting.mockResolvedValue(true);
  });

  it.each([null, "https://other.example.test"])("rejects an invalid request origin before verifying the credential: %s", async (origin) => {
    expect((await POST(request(origin))).status).toBe(403);
    expect(csrf.validateCsrfValue).not.toHaveBeenCalled();
    expect(webauthn.verifyRegistrationResponse).not.toHaveBeenCalled();
    expect(prisma.passkey.create).not.toHaveBeenCalled();
  });

  it("continues to check a same-origin request", async () => {
    expect((await POST(request("http://localhost:3000"))).status).toBe(400);
    expect(csrf.validateCsrfValue).toHaveBeenCalledWith("valid-token");
  });

  it("rejects a registration challenge from another session of the same user", async () => {
    const challenge = encodePasskeyChallenge({ challenge: "challenge", purpose: "registration", userId: "admin_1", sessionId: "session_other" });
    const response = await POST(request("http://localhost:3000", `${PASSKEY_REGISTRATION_COOKIE}=${challenge}`));
    expect(response.status).toBe(400);
    expect(webauthn.verifyRegistrationResponse).not.toHaveBeenCalled();
    expect(prisma.passkey.create).not.toHaveBeenCalled();
  });
});
