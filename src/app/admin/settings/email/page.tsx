import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { adminLoginPath } from "@/lib/admin-login-path";
import { requireSiteAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { getSmtpSettingsSummary, getSmtpTransportConfig } from "@/lib/smtp-settings";
import { getSetting } from "@/lib/settings";
import { restoreEnvironmentSmtpAction, savePasswordResetSettingAction, sendSmtpTestAction } from "./actions";
import { SmtpSettingsForm } from "./SmtpSettingsForm";

export const metadata: Metadata = { title: "Email settings" };

export default async function EmailSettingsPage() {
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminLoginPath("/admin/settings/email"));
  const [settings, csrf, passwordResetsEnabled, localLoginEnabled, smtp] = await Promise.all([
    getSmtpSettingsSummary(), getCsrfToken(), getSetting("emailPasswordResetsEnabled"),
    getSetting("localLoginEnabled"), getSmtpTransportConfig()
  ]);
  const configured = Boolean(settings.host && settings.from);

  return (
    <main className="admin-content">
      <div className="content-header content-header-topbar">
        <div>
          <h1>Email settings</h1>
          <p className="muted">Configure SMTP delivery for account verification emails.</p>
        </div>
        <div className="content-header-actions">
          <Link className="button secondary" href="/admin/settings">Back to Settings</Link>
        </div>
      </div>

      <section className="surface surface-panel email-template-link-card">
        <div>
          <h2>Email templates</h2>
          <p className="muted small">Edit the plain-text and HTML versions of system emails and send previews.</p>
        </div>
        <Link className="button secondary" href="/admin/settings/email/templates">Open Email templates</Link>
      </section>

      <section className="surface settings-primary-card">
        <div className="settings-card-header">
          <h2>SMTP server</h2>
          <span className={configured ? "status-pill status-pill-active" : "status-pill"}>
            {configured ? "Configured" : "Not configured"}
          </span>
        </div>
        <p className="muted small">
          {settings.source === "environment"
            ? "Using server environment settings. Saving this form creates a dashboard managed override."
            : settings.source === "settings"
              ? "Using settings saved in the dashboard. To disable delivery, clear the host, sender email, and From name, turn off SMTP login, then check and save."
              : "Add an SMTP server to send verification codes to a user’s current email address."}
        </p>
        <SmtpSettingsForm csrf={csrf} settings={settings} />
      </section>

      <section className="surface surface-panel">
        <h2>Password recovery</h2>
        <p className="muted">Allow people with an existing local password to request a single-use reset link by email. Links expire after 15 minutes. Resetting a password signs out all existing sessions and keeps TOTP enabled.</p>
        <p className="muted small">Existing accounts become eligible after a successful password sign-in. Accounts created only through an external provider cannot use email password reset.</p>
        <form className="form-stack" action={savePasswordResetSettingAction}>
          <input type="hidden" name="csrf" value={csrf} />
          <label><span><input className="inline-control" name="emailPasswordResetsEnabled" type="checkbox" defaultChecked={passwordResetsEnabled} disabled={!smtp || !localLoginEnabled} />{" "}Enable email password resets</span></label>
          {!smtp ? <p className="muted small">Configure SMTP delivery to enable this option.</p> : null}
          {!localLoginEnabled ? <p className="muted small">Enable password sign-in under Sign-in methods to use password recovery.</p> : null}
          <button type="submit">Save password recovery setting</button>
        </form>
      </section>

      <section className="surface surface-panel">
        <h2>Test delivery</h2>
        <p className="muted">Send a test message to a mailbox or alias that can receive mail. This can differ from your Surls account address. You can send up to 10 test messages every 15 minutes.</p>
        <div className="row-actions">
          <form className="form-stack smtp-test-delivery-form" action={sendSmtpTestAction}>
            <input type="hidden" name="csrf" value={csrf} />
            <label>Test recipient email<input name="recipient" type="email" required maxLength={320} placeholder="mailbox@example.com" autoComplete="email" /></label>
            <button type="submit" disabled={!configured}>Send test email</button>
          </form>
          {settings.source === "settings" ? (
            <form action={restoreEnvironmentSmtpAction}>
              <input type="hidden" name="csrf" value={csrf} />
              <button className="secondary" type="submit">Restore environment settings</button>
            </form>
          ) : null}
        </div>
      </section>
    </main>
  );
}
