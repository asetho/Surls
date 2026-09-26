import { beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({ sendMail: vi.fn(), close: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => transport) } }));
vi.mock("@/lib/smtp-settings", () => ({
  getSmtpTransportConfig: vi.fn(async () => ({
    host: "smtp.example.test", port: 587, from: "surls@example.test", username: null, password: null
  }))
}));

import { sendExternalConnectCode } from "@/lib/profile-email";

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
    expect(transport.close).toHaveBeenCalledOnce();
  });
});
