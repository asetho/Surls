import { describe, expect, it, vi } from "vitest";
import { decodeTotpSetupProof, encodeTotpSetupProof, totpSetupProofCookieOptions, totpSetupProofUseKey } from "@/lib/totp-setup-proof";

describe("TOTP setup proof", () => {
  it("signs a short-lived, purpose-bound proof for one user and session", () => {
    const cookie = encodeTotpSetupProof("user_1", "session_1");
    const proof = decodeTotpSetupProof(cookie);
    expect(proof).toMatchObject({ purpose: "totp-setup", userId: "user_1", sessionId: "session_1" });
    expect(proof?.nonce.length).toBeGreaterThanOrEqual(30);
    expect(proof && totpSetupProofUseKey(proof.nonce)).toMatch(/^profile:totp-setup:[a-f0-9]{64}$/);
    expect(decodeTotpSetupProof(`${cookie}x`)).toBeNull();
    expect(totpSetupProofCookieOptions()).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/admin/profile", maxAge: 300 });
  });

  it("expires after five minutes", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-26T12:00:00Z"));
      const cookie = encodeTotpSetupProof("user_1", "session_1");
      vi.setSystemTime(new Date("2026-09-26T12:05:01Z"));
      expect(decodeTotpSetupProof(cookie)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
