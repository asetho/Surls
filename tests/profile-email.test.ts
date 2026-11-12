import { beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({ sendMail: vi.fn(), verify: vi.fn(async () => true), close: vi.fn() }));
const templateStore = vi.hoisted(() => ({ findUnique: vi.fn(async (): Promise<{ value: unknown } | null> => null) }));
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => transport) } }));
vi.mock("@/lib/prisma", () => ({ prisma: { appSetting: templateStore } }));
vi.mock("@/lib/smtp-settings", () => ({
  getSmtpTransportConfig: vi.fn(async () => ({
    host: "smtp.example.test", port: 587, from: "surls@example.test", fromName: "Surls", username: null, password: null
  }))
}));

import { sendEmailTemplatePreview, sendExternalConnectCode, verifySmtpConnection } from "@/lib/profile-email";
import { EMAIL_TEMPLATES } from "@/lib/email-templates";

describe("provider connection email", () => {
  beforeEach(() => vi.clearAllMocks());

  it("describes the provider connection rather than an email change", async () => {
    await sendExternalConnectCode("user@example.test", "123456");

    expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "user@example.test",
      subject: "Surls sign-in provider connection verification code",
      text: expect.stringContaining("provider connection verification code is 123456"),
      html: expect.stringContaining("<strong>123456</strong>")
    }));
    expect(transport.sendMail.mock.calls[0][0].text).not.toMatch(/email change/i);
    expect(transport.sendMail.mock.calls[0][0].from).toEqual({ name: "Surls", address: "surls@example.test" });
    expect(transport.close).toHaveBeenCalledOnce();
  });

  it("sends unsaved text and HTML previews with inactive example values", async () => {
    await sendEmailTemplatePreview("inbox@example.test", "passwordReset", EMAIL_TEMPLATES.passwordReset.defaults);
    expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "inbox@example.test",
      subject: "[Preview] Reset your Surls password",
      text: expect.stringContaining("https://example.invalid/preview-reset"),
      html: expect.stringContaining("https://example.invalid/preview-reset")
    }));
    expect(transport.sendMail.mock.calls[0][0].text).toContain("Preview only");
  });

  it("uses a saved template for real system messages", async () => {
    templateStore.findUnique.mockResolvedValueOnce({ value: {
      subject: "Connect your account", text: "Enter {{code}} to connect.", html: "<p>Enter <b>{{code}}</b> to connect.</p>"
    } });
    await sendExternalConnectCode("user@example.test", "654321");
    expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      subject: "Connect your account", text: "Enter 654321 to connect.", html: "<p>Enter <b>654321</b> to connect.</p>"
    }));
  });

  it("checks SMTP login without sending or retaining a connection", async () => {
    await verifySmtpConnection({
      host: "smtp.example.test", port: 465, from: "surls@example.test", fromName: "Surls",
      username: "surls@example.test", password: "secret"
    });

    expect(transport.verify).toHaveBeenCalledOnce();
    expect(transport.sendMail).not.toHaveBeenCalled();
    expect(transport.close).toHaveBeenCalledOnce();
  });

  it("closes the SMTP connection when login fails", async () => {
    transport.verify.mockRejectedValueOnce(new Error("login failed"));
    await expect(verifySmtpConnection({
      host: "smtp.example.test", port: 587, from: "surls@example.test", fromName: "",
      username: "surls@example.test", password: "wrong"
    })).rejects.toThrow("login failed");
    expect(transport.close).toHaveBeenCalledOnce();
    expect(transport.sendMail).not.toHaveBeenCalled();
  });
});
