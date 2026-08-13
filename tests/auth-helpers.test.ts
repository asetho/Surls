import { describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { generateBackupCode, hashBackupCode, verifyBackupCode } from "@/lib/backup-codes";
import { createPlainApiToken } from "@/lib/api-tokens";
import { isAdminUser } from "@/lib/auth";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { decodePasskeyChallenge, encodePasskeyChallenge } from "@/lib/passkeys";
import { decodePendingLogin, encodePendingLogin, PENDING_LOGIN_MAX_AGE_SECONDS } from "@/lib/pending-login";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createTotpSecret, verifyTotpCode } from "@/lib/totp";
import { generate } from "otplib";
import { getTotpSecret } from "@/lib/totp";

describe("auth helpers", () => {
  it("hashes passwords with verifiable one-way hashes", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword(hash, "correct horse battery staple")).toBe(true);
    expect(await verifyPassword(hash, "wrong password")).toBe(false);
  });

  it("generates one-time backup code hashes", async () => {
    const code = generateBackupCode();
    const hash = await hashBackupCode(code);
    expect(hash).not.toContain(code);
    expect(await verifyBackupCode(hash, code)).toBe(true);
    expect(await verifyBackupCode(hash, "AAAAA-BBBBB")).toBe(false);
  });

  it("creates API tokens with the Surls prefix", () => {
    expect(createPlainApiToken()).toMatch(/^surls_/);
  });

  it("distinguishes admin and user roles", () => {
    expect(isAdminUser({ role: UserRole.ADMIN })).toBe(true);
    expect(isAdminUser({ role: UserRole.USER })).toBe(false);
  });

  it("signs short-lived passkey challenges by purpose", () => {
    const signed = encodePasskeyChallenge({ challenge: "abc123", purpose: "authentication" });
    expect(decodePasskeyChallenge(signed, "authentication")).toMatchObject({
      challenge: "abc123",
      purpose: "authentication"
    });
    expect(decodePasskeyChallenge(signed, "registration")).toBeNull();
    expect(decodePasskeyChallenge(`${signed}x`, "authentication")).toBeNull();
  });

  it("signs short-lived pending 2FA login state", () => {
    const now = new Date("2026-06-11T16:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      for (const nextPath of ["//evil.example/admin", "/\\evil.example/admin"]) {
        const signed = encodePendingLogin({
          email: "admin@example.com",
          nextPath,
          userId: "user_123"
        });
        expect(decodePendingLogin(signed)).toMatchObject({
          email: "admin@example.com",
          nextPath: "/admin",
          userId: "user_123"
        });
        expect(decodePendingLogin(`${signed}x`)).toBeNull();
      }
      const expiring = encodePendingLogin({
        email: "admin@example.com",
        nextPath: "/admin/links",
        userId: "user_123"
      });

      vi.setSystemTime(new Date(now.getTime() + PENDING_LOGIN_MAX_AGE_SECONDS * 1000 + 1));
      expect(decodePendingLogin(expiring)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("verifies TOTP codes generated from encrypted secrets", async () => {
    const setup = createTotpSecret("admin@example.com", "Test Links");
    expect(decodeURIComponent(setup.otpauthUrl)).toContain("issuer=Test Links");
    const token = await generate({ secret: getTotpSecret(setup.encryptedSecret), period: 30, digits: 6 });
    await expect(verifyTotpCode(setup.encryptedSecret, token)).resolves.toBe(true);
  });

  it("requires full-length authentication tags for encrypted secrets", () => {
    const encrypted = encryptSecret("test secret");
    expect(decryptSecret(encrypted)).toBe("test secret");

    const [iv, tag, ciphertext] = encrypted.split(".");
    const shortenedTag = Buffer.from(tag, "base64url").subarray(0, 12).toString("base64url");
    expect(() => decryptSecret(`${iv}.${shortenedTag}.${ciphertext}`)).toThrow(
      "Invalid encrypted secret payload."
    );
  });
});
