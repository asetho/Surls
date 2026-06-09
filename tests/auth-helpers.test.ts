import { describe, expect, it } from "vitest";
import { generateBackupCode, hashBackupCode, verifyBackupCode } from "@/lib/backup-codes";
import { createPlainApiToken } from "@/lib/api-tokens";
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

  it("verifies TOTP codes generated from encrypted secrets", async () => {
    const setup = createTotpSecret("admin@example.com", "Test Links");
    expect(decodeURIComponent(setup.otpauthUrl)).toContain("issuer=Test Links");
    const token = await generate({ secret: getTotpSecret(setup.encryptedSecret), period: 30, digits: 6 });
    await expect(verifyTotpCode(setup.encryptedSecret, token)).resolves.toBe(true);
  });
});
