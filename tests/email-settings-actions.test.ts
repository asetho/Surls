import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireSiteAdmin: vi.fn() }));
const csrf = vi.hoisted(() => ({ validateCsrf: vi.fn() }));
const email = vi.hoisted(() => ({ sendSmtpTestEmail: vi.fn(), verifySmtpConnection: vi.fn() }));
const rateLimit = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const navigation = vi.hoisted(() => ({ redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/csrf", () => csrf);
vi.mock("@/lib/profile-email", () => email);
vi.mock("@/lib/rate-limit", () => rateLimit);
vi.mock("@/lib/settings", () => ({ getSetting: vi.fn(), setSetting: vi.fn() }));
vi.mock("@/lib/audit", () => ({ auditLog: vi.fn() }));
vi.mock("@/lib/smtp-settings", () => ({
  getSmtpTransportConfig: vi.fn(), getSmtpSettingsCheckConfig: vi.fn(),
  saveCheckedSmtpSettings: vi.fn(), restoreEnvironmentSmtpSettings: vi.fn(),
  SmtpSettingsError: class SmtpSettingsError extends Error {}
}));
vi.mock("next/navigation", () => navigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin-toast", () => ({
  adminToastPath: (_path: string, _type: string, message: string) => `/admin/settings/email?toast=${message}`
}));

function form(recipient: string) {
  const data = new FormData();
  data.set("recipient", recipient);
  return data;
}

describe("SMTP test delivery action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireSiteAdmin.mockResolvedValue({ id: "admin_1", email: "account@example.com" });
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true });
  });

  it("sends to the chosen inbox rather than the account address", async () => {
    const { sendSmtpTestAction } = await import("@/app/admin/settings/email/actions");
    await expect(sendSmtpTestAction(form(" inbox@example.com "))).rejects.toThrow("Test email accepted by the SMTP server");
    expect(email.sendSmtpTestEmail).toHaveBeenCalledWith("inbox@example.com");
    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith("smtp:test:admin_1", 10, 15 * 60 * 1000);
  });

  it("rejects an invalid recipient before consuming the delivery limit", async () => {
    const { sendSmtpTestAction } = await import("@/app/admin/settings/email/actions");
    await expect(sendSmtpTestAction(form("invalid"))).rejects.toThrow("Enter a valid test recipient");
    expect(email.sendSmtpTestEmail).not.toHaveBeenCalled();
    expect(rateLimit.checkRateLimit).not.toHaveBeenCalled();
  });

  it("explains an unknown recipient without exposing the SMTP response", async () => {
    email.sendSmtpTestEmail.mockRejectedValueOnce(Object.assign(new Error("private server details"), {
      command: "RCPT TO", responseCode: 550
    }));
    const { sendSmtpTestAction } = await import("@/app/admin/settings/email/actions");
    await expect(sendSmtpTestAction(form("missing@example.com"))).rejects.toThrow("rejected that recipient (550)");
    expect(navigation.redirect.mock.calls[0][0]).not.toContain("private server details");
  });
});

describe("SMTP check before save actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireSiteAdmin.mockResolvedValue({ id: "admin_1", email: "account@example.com" });
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true });
  });

  it("returns a save proof only after the SMTP connection succeeds", async () => {
    const smtp = await import("@/lib/smtp-settings");
    vi.mocked(smtp.getSmtpSettingsCheckConfig).mockResolvedValue({ host: "smtp.example.test", port: 465,
      from: "sender@example.test", fromName: "Surls", username: "sender@example.test", password: "secret" });
    const { checkSmtpConnectionAction } = await import("@/app/admin/settings/email/actions");
    const result = await checkSmtpConnectionAction(form(""));
    expect(result).toMatchObject({ ok: true, proof: expect.any(String), expiresAt: expect.any(Number) });
    expect(email.verifySmtpConnection).toHaveBeenCalledOnce();
    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith("smtp:connection:admin_1", 3, 15 * 60 * 1000);
  });

  it("does not issue a proof after a failed connection", async () => {
    const smtp = await import("@/lib/smtp-settings");
    vi.mocked(smtp.getSmtpSettingsCheckConfig).mockResolvedValue({ host: "smtp.example.test", port: 465,
      from: "sender@example.test", fromName: "", username: "sender@example.test", password: "wrong" });
    email.verifySmtpConnection.mockRejectedValueOnce(new Error("private SMTP error"));
    const { checkSmtpConnectionAction } = await import("@/app/admin/settings/email/actions");
    const result = await checkSmtpConnectionAction(form(""));
    expect(result).toMatchObject({ ok: false });
    expect(result).not.toHaveProperty("proof");
    expect(result.message).not.toContain("private SMTP error");
  });

  it("checks the empty configuration without an SMTP connection so it can be disabled", async () => {
    const smtp = await import("@/lib/smtp-settings");
    vi.mocked(smtp.getSmtpSettingsCheckConfig).mockResolvedValue({ host: "", port: 587,
      from: "", fromName: "", username: "", password: "" });
    const { checkSmtpConnectionAction } = await import("@/app/admin/settings/email/actions");
    const result = await checkSmtpConnectionAction(form(""));
    expect(result).toMatchObject({ ok: true, proof: expect.any(String) });
    expect(email.verifySmtpConnection).not.toHaveBeenCalled();
    expect(rateLimit.checkRateLimit).not.toHaveBeenCalled();
  });

  it("passes the check proof to the guarded save operation", async () => {
    const smtp = await import("@/lib/smtp-settings");
    vi.mocked(smtp.saveCheckedSmtpSettings).mockResolvedValue({ enabled: true, authenticated: true });
    const data = form("");
    data.set("smtpCheckProof", "signed-proof");
    const { saveSmtpSettingsAction } = await import("@/app/admin/settings/email/actions");
    await expect(saveSmtpSettingsAction(data)).rejects.toThrow("Email settings saved");
    expect(smtp.saveCheckedSmtpSettings).toHaveBeenCalledWith(data, "admin_1", "signed-proof");
  });
});
