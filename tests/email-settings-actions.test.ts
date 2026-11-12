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
  getSmtpTransportConfig: vi.fn(), getSmtpConnectionTestConfig: vi.fn(),
  saveSmtpSettings: vi.fn(), restoreEnvironmentSmtpSettings: vi.fn(),
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
