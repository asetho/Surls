import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; passwordResetEligible: boolean; passwordHash: string },
  token: null as null | { userId: string; tokenHash: string; emailHash: string; expiresAt: Date },
  enabled: true,
  localLoginEnabled: true,
  smtpAvailable: true
}));

const db = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) =>
      state.user && (state.user.email === where.email || state.user.id === where.id) ? state.user : null),
    updateMany: vi.fn(async ({ where, data }: { where: { id: string; email: string; passwordResetEligible: boolean }; data: { passwordHash: string } }) => {
      if (!state.user || state.user.id !== where.id || state.user.email !== where.email || !state.user.passwordResetEligible) return { count: 0 };
      state.user.passwordHash = data.passwordHash;
      return { count: 1 };
    })
  },
  passwordResetToken: {
    upsert: vi.fn(async ({ create }: { create: NonNullable<typeof state.token> }) => { state.token = create; }),
    findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) =>
      state.token?.tokenHash === where.tokenHash ? state.token : null),
    deleteMany: vi.fn(async ({ where }: { where: { userId: string; tokenHash: string; expiresAt?: { gt: Date } } }) => {
      if (!state.token || state.token.userId !== where.userId || state.token.tokenHash !== where.tokenHash ||
          (where.expiresAt && state.token.expiresAt <= where.expiresAt.gt)) return { count: 0 };
      state.token = null;
      return { count: 1 };
    })
  },
  session: { deleteMany: vi.fn(async () => ({ count: 2 })) },
  $transaction: vi.fn(async (callback: (client: typeof db) => Promise<unknown>) => callback(db))
}));

const mail = vi.hoisted(() => ({
  sendPasswordResetEmail: vi.fn(async (to: string, url: string) => { void to; void url; }),
  sendPasswordChangedEmail: vi.fn(async (to: string) => { void to; })
}));
const audit = vi.hoisted(() => ({ auditLog: vi.fn(async () => undefined) }));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/profile-email", () => mail);
vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn(async () => "new-password-hash") }));
vi.mock("@/lib/settings", () => ({ getSetting: vi.fn(async (key: string) =>
  key === "emailPasswordResetsEnabled" ? state.enabled : state.localLoginEnabled) }));
vi.mock("@/lib/smtp-settings", () => ({ getSmtpTransportConfig: vi.fn(async () =>
  state.smtpAvailable ? { host: "smtp.example.com" } : null) }));
vi.mock("@/lib/env", () => ({ env: { AUTH_SECRET: "test-only-test-only-test-only-test-only" }, appBaseUrl: () => "https://surls.example" }));

describe("email password recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = { id: "user-1", email: "admin@example.com", passwordResetEligible: true, passwordHash: "old-hash" };
    state.token = null;
    state.enabled = true;
    state.localLoginEnabled = true;
    state.smtpAvailable = true;
  });

  it("only sends a reset link to an eligible local-password account", async () => {
    const { requestPasswordReset } = await import("@/lib/password-reset");
    state.user!.passwordResetEligible = false;
    await requestPasswordReset("admin@example.com");
    expect(mail.sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(state.token).toBeNull();

    state.user!.passwordResetEligible = true;
    await requestPasswordReset("admin@example.com");
    expect(mail.sendPasswordResetEmail).toHaveBeenCalledOnce();
    const url = new URL(mail.sendPasswordResetEmail.mock.calls[0][1]);
    expect(url.origin).toBe("https://surls.example");
    expect(url.pathname).toBe("/reset-password");
    expect(state.token?.tokenHash).not.toBe(url.searchParams.get("token"));
  });

  it("rejects disabled recovery and removes an undelivered token", async () => {
    const { requestPasswordReset } = await import("@/lib/password-reset");
    state.enabled = false;
    await requestPasswordReset("admin@example.com");
    expect(state.token).toBeNull();
    state.enabled = true;
    mail.sendPasswordResetEmail.mockRejectedValueOnce(new Error("SMTP unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await requestPasswordReset("admin@example.com");
    expect(state.token).toBeNull();
    log.mockRestore();
  });

  it("consumes a token once, changes the password, and signs out existing sessions", async () => {
    const { requestPasswordReset, completePasswordReset } = await import("@/lib/password-reset");
    await requestPasswordReset("admin@example.com");
    const token = new URL(mail.sendPasswordResetEmail.mock.calls[0][1]).searchParams.get("token")!;
    expect(await completePasswordReset(token, "a new long password")).toBe("success");
    expect(state.user?.passwordHash).toBe("new-password-hash");
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(mail.sendPasswordChangedEmail).toHaveBeenCalledWith("admin@example.com");
    expect(await completePasswordReset(token, "another long password")).toBe("invalid");
  });

  it("rejects expired links and links issued before an email change", async () => {
    const { requestPasswordReset, completePasswordReset } = await import("@/lib/password-reset");
    await requestPasswordReset("admin@example.com");
    const token = new URL(mail.sendPasswordResetEmail.mock.calls[0][1]).searchParams.get("token")!;
    state.user!.email = "new@example.com";
    expect(await completePasswordReset(token, "a new long password")).toBe("invalid");
    expect(db.session.deleteMany).not.toHaveBeenCalled();
    state.user!.email = "admin@example.com";
    state.token!.expiresAt = new Date(Date.now() - 1);
    expect(await completePasswordReset(token, "a new long password")).toBe("invalid");
  });
});
