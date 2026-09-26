import { describe, expect, it, vi } from "vitest";
import { generateBackupCodes } from "@/lib/backup-codes";
import { hashToken } from "@/lib/crypto";
import { createProfileEmailCode, decodeProfileEmailCode, verifyProfileEmailCode } from "@/lib/profile-email-code";
import { createTotpEnrollment, decodeTotpEnrollment, decodeTotpSetup, encodeTotpSetup, totpSetupSecretForSession } from "@/lib/totp-enrollment";
import { createTotpSetupEmailCode, decodeTotpSetupEmailCode, verifyTotpSetupEmailCode } from "@/lib/totp-setup-email-code";

describe("profile verification proofs", () => {
  it("binds an email code to a signed proof and rejects a changed cookie or wrong code", () => {
    const { code, cookie } = createProfileEmailCode("user_1", "session_1", "old@example.com", "new@example.com");
    const proof = decodeProfileEmailCode(cookie);
    expect(proof).toMatchObject({
      userId: "user_1", sessionId: "session_1", currentEmail: "old@example.com", pendingEmail: "new@example.com"
    });
    expect(proof && verifyProfileEmailCode(proof, code)).toBe(true);
    expect(proof && verifyProfileEmailCode(proof, code === "000000" ? "111111" : "000000")).toBe(false);
    expect(decodeProfileEmailCode(`${cookie}changed`)).toBeNull();
  });

  it("encrypts a pending TOTP enrollment and rejects a changed cookie", () => {
    const codes = generateBackupCodes();
    const { cookie, nonce } = createTotpEnrollment("user_1", "session_1", "encrypted-secret", codes);
    expect(decodeTotpEnrollment(cookie)).toMatchObject({
      userId: "user_1", sessionId: "session_1", nonce,
      secretFingerprint: hashToken("encrypted-secret"), codes
    });
    const rotated = createTotpEnrollment("user_1", "session_1", "rotated-secret", codes).cookie;
    expect(decodeTotpEnrollment(rotated)?.secretFingerprint).not.toBe(decodeTotpEnrollment(cookie)?.secretFingerprint);
    expect(decodeTotpEnrollment(`${cookie}changed`)).toBeNull();
    expect(cookie).not.toContain(codes[0]);
  });

  it("signs a purpose-specific TOTP setup email code and expires it", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-26T12:00:00Z"));
      const { code, cookie } = createTotpSetupEmailCode("user_1", "session_1", "current@example.com");
      const proof = decodeTotpSetupEmailCode(cookie);
      expect(proof).toMatchObject({
        purpose: "totp-setup-email", userId: "user_1", sessionId: "session_1", currentEmail: "current@example.com"
      });
      expect(proof && verifyTotpSetupEmailCode(proof, code)).toBe(true);
      expect(proof && verifyTotpSetupEmailCode(proof, code === "000000" ? "111111" : "000000")).toBe(false);
      expect(decodeTotpSetupEmailCode(`${cookie}changed`)).toBeNull();
      vi.setSystemTime(new Date("2026-09-26T12:11:00Z"));
      expect(decodeTotpSetupEmailCode(cookie)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("encrypts a session-bound setup seed and expires it", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-26T12:00:00Z"));
      const cookie = encodeTotpSetup("user_1", "session_1", "encrypted-secret");
      expect(decodeTotpSetup(cookie)).toMatchObject({
        userId: "user_1", sessionId: "session_1", secretEncrypted: "encrypted-secret"
      });
      expect(totpSetupSecretForSession(cookie, "user_1", "session_1")).toBe("encrypted-secret");
      expect(totpSetupSecretForSession(cookie, "user_1", "session_other")).toBeNull();
      expect(totpSetupSecretForSession(cookie, "user_other", "session_1")).toBeNull();
      expect(cookie).not.toContain("encrypted-secret");
      expect(decodeTotpSetup(`${cookie}changed`)).toBeNull();
      vi.setSystemTime(new Date("2026-09-26T12:31:00Z"));
      expect(decodeTotpSetup(cookie)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
