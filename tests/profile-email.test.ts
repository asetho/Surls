import { beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({ sendMail: vi.fn(), verify: vi.fn(async () => true), close: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => transport) } }));
vi.mock("@/lib/smtp-settings", () => ({
  getSmtpTransportConfig: vi.fn(async () => ({
    host: "smtp.example.test", port: 587, from: "surls@example.test", fromName: "Surls", username: null, password: null
  }))
}));

import { sendExternalConnectCode, verifySmtpConnection } from "@/lib/profile-email";

describe("provider connection email", () => {
  beforeEach(() => vi.clearAllMocks());

  it("describes the provider connection rather than an email change", async () => {
    await sendExternalConnectCode("user@example.test", "123456");

    expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "user@example.test",
      subject: "Surls sign-in provider connection verification code",
      text: expect.stringContaining("provider connection verification code is 123456")
    }));
    expect(transport.sendMail.mock.calls[0][0].text).not.toMatch(/email change/i);
    expect(transport.sendMail.mock.calls[0][0].from).toEqual({ name: "Surls", address: "surls@example.test" });
    expect(transport.close).toHaveBeenCalledOnce();
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
