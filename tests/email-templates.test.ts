import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => new Map<string, unknown>());
const appSetting = vi.hoisted(() => ({
  findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
    rows.has(where.key) ? { key: where.key, value: rows.get(where.key) } : null),
  upsert: vi.fn(async ({ where, create }: { where: { key: string }; create: { value: unknown } }) => {
    rows.set(where.key, create.value);
  }),
  deleteMany: vi.fn(async ({ where }: { where: { key: string } }) => {
    rows.delete(where.key);
  })
}));
vi.mock("@/lib/prisma", () => ({ prisma: { appSetting } }));

import {
  EMAIL_TEMPLATES, getEmailTemplate, renderEmailTemplate, restoreEmailTemplate,
  saveEmailTemplate, validateEmailTemplate
} from "@/lib/email-templates";

describe("system email templates", () => {
  beforeEach(() => { rows.clear(); vi.clearAllMocks(); });

  it("keeps the current message as the default and restores it after customization", async () => {
    const original = await getEmailTemplate("emailChange");
    expect(original).toMatchObject({ customized: false, content: { subject: "Surls email change verification code" } });
    const replacement = { ...original.content, subject: "Verify your address" };
    await saveEmailTemplate("emailChange", replacement);
    expect(await getEmailTemplate("emailChange")).toEqual({ customized: true, content: replacement });
    await restoreEmailTemplate("emailChange");
    expect(await getEmailTemplate("emailChange")).toEqual(original);
  });

  it("uses the built-in message if a stored override is malformed", async () => {
    rows.set("emailTemplate:emailChange", { subject: "Incomplete" });
    expect(await getEmailTemplate("emailChange")).toMatchObject({
      customized: false, content: { subject: "Surls email change verification code" }
    });
  });

  it("requires recovery links and verification codes in both mail versions", () => {
    const reset = EMAIL_TEMPLATES.passwordReset.defaults;
    expect(() => validateEmailTemplate("passwordReset", { ...reset, html: "<p>Reset your password</p>" }))
      .toThrow("Include {{resetUrl}} in both message bodies.");
    expect(() => validateEmailTemplate("emailChange", { ...EMAIL_TEMPLATES.emailChange.defaults, text: "No code" }))
      .toThrow("Include {{code}} in both message bodies.");
  });

  it("rejects unknown placeholders and subject header breaks", () => {
    const template = EMAIL_TEMPLATES.smtpTest.defaults;
    expect(() => validateEmailTemplate("smtpTest", { ...template, html: "<p>{{unknown}}</p>" })).toThrow("placeholders shown");
    expect(() => validateEmailTemplate("smtpTest", { ...template, subject: "Hello\nBcc: attacker@example.test" })).toThrow("valid subject");
  });

  it("escapes dynamic values in HTML while retaining them in plain text", () => {
    const url = 'https://example.test/reset?value=" onclick="bad';
    const rendered = renderEmailTemplate("passwordReset", EMAIL_TEMPLATES.passwordReset.defaults, { resetUrl: url });
    expect(rendered.text).toContain(url);
    expect(rendered.html).toContain('href="https://example.test/reset?value=&quot; onclick=&quot;bad"');
    expect(rendered.html).not.toContain('onclick="bad"');
  });

  it("never renders a security email without its code or reset URL", () => {
    expect(() => renderEmailTemplate("emailChange", EMAIL_TEMPLATES.emailChange.defaults, {}))
      .toThrow("required email value is missing");
    expect(() => renderEmailTemplate("passwordReset", EMAIL_TEMPLATES.passwordReset.defaults, { resetUrl: "" }))
      .toThrow("required email value is missing");
  });
});
