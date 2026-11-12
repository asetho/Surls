import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { AUTH_SECRET: "test-only-test-only-test-only-test-only" } }));

import { createSmtpCheckProof, verifySmtpCheckProof } from "@/lib/smtp-check-proof";

const config = {
  host: "mail.example.test", port: 465, from: "sender@example.test", fromName: "Surls",
  username: "sender@example.test", password: "private password"
};

describe("SMTP check proof", () => {
  it("binds a recent check to the administrator and exact effective settings without revealing the password", () => {
    const now = 1_000_000;
    const { proof, expiresAt } = createSmtpCheckProof("admin_1", config, now);
    expect(proof).not.toContain(config.password);
    expect(expiresAt).toBe(now + 5 * 60 * 1000);
    expect(verifySmtpCheckProof(proof, "admin_1", config, now + 1)).toBe(true);
    expect(verifySmtpCheckProof(proof, "admin_2", config, now + 1)).toBe(false);
    expect(verifySmtpCheckProof(proof, "admin_1", { ...config, fromName: "Other" }, now + 1)).toBe(false);
    expect(verifySmtpCheckProof(proof, "admin_1", { ...config, password: "changed" }, now + 1)).toBe(false);
    expect(verifySmtpCheckProof(proof, "admin_1", config, expiresAt)).toBe(false);
    expect(verifySmtpCheckProof(`${proof}x`, "admin_1", config, now + 1)).toBe(false);
  });

  it("permits a checked empty configuration only for that same disabled state", () => {
    const disabled = { host: "", port: 587, from: "", fromName: "", username: "", password: "" };
    const { proof } = createSmtpCheckProof("admin_1", disabled, 500);
    expect(verifySmtpCheckProof(proof, "admin_1", disabled, 501)).toBe(true);
    expect(verifySmtpCheckProof(proof, "admin_1", { ...disabled, port: 465 }, 501)).toBe(false);
  });
});
