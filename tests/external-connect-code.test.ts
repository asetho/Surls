import { describe, expect, it, vi } from "vitest";
import { createExternalConnectCode, decodeExternalConnectCode, externalConnectCodeCookieOptions, verifyExternalConnectCode } from "@/lib/external-connect-code";

describe("external Connect email code", () => {
  it("signs a code for the current user, session, email, and exact target", () => {
    const { code, cookie } = createExternalConnectCode("user_1", "session_1", "current@example.com", "oidc-asetho-link");
    const proof = decodeExternalConnectCode(cookie);
    expect(proof).toMatchObject({ userId: "user_1", sessionId: "session_1", currentEmail: "current@example.com", targetProvider: "oidc-asetho-link" });
    expect(proof && verifyExternalConnectCode(proof, code)).toBe(true);
    expect(proof && verifyExternalConnectCode(proof, code === "000000" ? "111111" : "000000")).toBe(false);
    expect(decodeExternalConnectCode(`${cookie}x`)).toBeNull();
    expect(externalConnectCodeCookieOptions()).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/api/auth/external", maxAge: 600 });
  });

  it("expires after ten minutes", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-26T12:00:00Z"));
      const { cookie } = createExternalConnectCode("user_1", "session_1", "current@example.com", "google");
      vi.setSystemTime(new Date("2026-09-26T12:10:01Z"));
      expect(decodeExternalConnectCode(cookie)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
