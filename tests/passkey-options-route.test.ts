import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const webauthn = vi.hoisted(() => ({ generateAuthenticationOptions: vi.fn() }));
const rate = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const requestIp = vi.hoisted(() => vi.fn());
vi.mock("@simplewebauthn/server", () => webauthn);
vi.mock("@/lib/rate-limit", () => rate);
vi.mock("@/lib/request", () => ({ requestIp }));
vi.mock("@/lib/settings", () => ({ getSetting: async () => true }));

import { POST } from "@/app/api/auth/passkey/auth/options/route";
const request = () => new NextRequest("http://localhost:3000/api/auth/passkey/auth/options", { method: "POST" });

describe("accountless passkey options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestIp.mockReturnValue("unknown");
    rate.checkRateLimit.mockResolvedValue({ allowed: true });
    webauthn.generateAuthenticationOptions.mockResolvedValue({ challenge: "new-challenge" });
  });

  it("returns signed options without a shared unknown-IP lockout", async () => {
    const result = await POST(request());
    expect(result.status).toBe(200);
    expect(result.cookies.get("surls_passkey_authentication")?.value).toBeTruthy();
    expect(rate.checkRateLimit).not.toHaveBeenCalled();
    expect(webauthn.generateAuthenticationOptions).toHaveBeenCalledWith({ rpID: "localhost", userVerification: "required" });
  });

  it("retains rate limits for a trusted source IP", async () => {
    requestIp.mockReturnValue("8.8.8.8");
    rate.checkRateLimit.mockResolvedValue({ allowed: false });
    expect((await POST(request())).status).toBe(429);
    expect(webauthn.generateAuthenticationOptions).not.toHaveBeenCalled();
  });

  it("recovers options capacity after a generation failure", async () => {
    webauthn.generateAuthenticationOptions.mockRejectedValueOnce(new Error("generator failed"));
    await expect(POST(request())).rejects.toThrow("generator failed");
    for (let index = 0; index < 10; index += 1) expect((await POST(request())).status).toBe(200);
  });
});
