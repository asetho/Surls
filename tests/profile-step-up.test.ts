import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ totpCredential: { findUnique: vi.fn() } }));
const rate = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const totp = vi.hoisted(() => ({ verifyTotpCode: vi.fn() }));
const password = vi.hoisted(() => ({ verifyPassword: vi.fn() }));
const verification = vi.hoisted(() => ({ decodeProfileVerification: vi.fn(), profileVerificationUseKey: vi.fn(() => "proof-use"), PROFILE_VERIFICATION_COOKIE: "proof" }));
const settings = vi.hoisted(() => ({ getSetting: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/rate-limit", () => rate);
vi.mock("@/lib/totp", () => totp);
vi.mock("@/lib/password", () => password);
vi.mock("@/lib/profile-verification", () => verification);
vi.mock("@/lib/settings", () => settings);

const base = { userId: "user_1", sessionId: "session_1", sessionCreatedAt: new Date("2026-09-26T12:00:00Z"),
  passwordHash: "hash", action: "passkey-remove" as const, resourceId: "passkey_1", method: "password", password: "secret" };

describe("profile step-up policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rate.checkRateLimit.mockResolvedValue({ allowed: true });
    password.verifyPassword.mockResolvedValue(true);
    totp.verifyTotpCode.mockResolvedValue(true);
    prisma.totpCredential.findUnique.mockResolvedValue(null);
    settings.getSetting.mockResolvedValue(true);
  });

  it("requires the enrolled TOTP factor even when the correct password is known", async () => {
    prisma.totpCredential.findUnique.mockResolvedValue({ enabled: true, enabledAt: new Date("2026-09-25T12:00:00Z"), secretEncrypted: "secret" });
    const { verifyProfileStepUp } = await import("@/lib/profile-step-up");
    expect(await verifyProfileStepUp(base)).toMatchObject({ error: expect.stringContaining("authenticator") });
    expect(password.verifyPassword).not.toHaveBeenCalled();
    expect(await verifyProfileStepUp({ ...base, method: "totp", code: "123456" })).toEqual({});
  });

  it("rejects a provider proof for another action or passkey", async () => {
    verification.decodeProfileVerification.mockReturnValue({ userId: "user_1", sessionId: "session_1", action: "passkey-remove", resourceId: "other", nonce: "nonce", mfaVerified: true });
    const { verifyProfileStepUp } = await import("@/lib/profile-step-up");
    expect(await verifyProfileStepUp({ ...base, method: "provider", proofCookie: "signed" })).toMatchObject({ error: expect.any(String) });
    expect(rate.checkRateLimit).not.toHaveBeenCalled();
  });

  it("does not accept a provider proof without MFA when TOTP is enabled", async () => {
    prisma.totpCredential.findUnique.mockResolvedValue({ enabled: true, enabledAt: new Date("2026-09-25T12:00:00Z"), secretEncrypted: "secret" });
    verification.decodeProfileVerification.mockReturnValue({ userId: "user_1", sessionId: "session_1", action: "passkey-remove", resourceId: "passkey_1", nonce: "nonce", mfaVerified: false });
    const { verifyProfileStepUp } = await import("@/lib/profile-step-up");
    expect(await verifyProfileStepUp({ ...base, method: "provider", proofCookie: "signed" })).toMatchObject({ error: expect.any(String) });
  });

  it("uses a scoped linked-provider proof only once", async () => {
    verification.decodeProfileVerification.mockReturnValue({ userId: "user_1", sessionId: "session_1", action: "passkey-remove", resourceId: "passkey_1", nonce: "nonce", mfaVerified: false });
    const { verifyProfileStepUp } = await import("@/lib/profile-step-up");
    expect(await verifyProfileStepUp({ ...base, method: "provider", proofCookie: "signed" })).toEqual({ usedProvider: true });
    rate.checkRateLimit.mockResolvedValue({ allowed: false });
    expect(await verifyProfileStepUp({ ...base, method: "provider", proofCookie: "signed" })).toMatchObject({ error: expect.stringContaining("already used") });
  });

  it("uses current password when no authenticator is enrolled", async () => {
    const { verifyProfileStepUp } = await import("@/lib/profile-step-up");
    expect(await verifyProfileStepUp(base)).toEqual({});
    expect(password.verifyPassword).toHaveBeenCalledWith("hash", "secret");
  });
});
