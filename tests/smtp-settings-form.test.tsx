import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/app/admin/settings/email/actions", () => ({
  checkSmtpConnectionAction: vi.fn(), saveSmtpSettingsAction: vi.fn()
}));

import { SmtpSettingsForm } from "@/app/admin/settings/email/SmtpSettingsForm";

it("starts with Save disabled and offers the check first", () => {
  const markup = renderToStaticMarkup(<SmtpSettingsForm csrf="test" settings={{
    host: "mail.example.test", port: 465, from: "sender@example.test", fromName: "Surls",
    username: "sender@example.test", hasPassword: true, source: "settings"
  }} />);
  expect(markup).toContain("Check SMTP settings");
  expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Save email settings<\/button>/);
  expect(markup).toContain('name="smtpCheckProof" value=""');
});
