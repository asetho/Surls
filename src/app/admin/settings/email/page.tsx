import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { adminLoginPath } from "@/lib/admin-login-path";
import { requireSiteAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { getSmtpSettingsSummary } from "@/lib/smtp-settings";
import { restoreEnvironmentSmtpAction, saveSmtpSettingsAction, sendSmtpTestAction } from "./actions";

export const metadata: Metadata = { title: "Email settings" };

export default async function EmailSettingsPage() {
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminLoginPath("/admin/settings/email"));
  const [settings, csrf] = await Promise.all([getSmtpSettingsSummary(), getCsrfToken()]);
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
              ? "Using settings saved in the dashboard. Clear all fields and save to disable email delivery."
              : "Add an SMTP server to send verification codes to a user’s current email address."}
        </p>
        <form className="form-stack" action={saveSmtpSettingsAction}>
          <input type="hidden" name="csrf" value={csrf} />
          <div className="form-grid">
            <label>SMTP host<input name="host" defaultValue={settings.host} placeholder="smtp.example.com" maxLength={253} autoComplete="off" /></label>
            <label>Port<input name="port" type="number" required min="1" max="65535" defaultValue={settings.port} /></label>
            <label>Sender email<input name="from" type="email" defaultValue={settings.from} placeholder="no-reply@example.com" maxLength={320} autoComplete="off" /></label>
            <label>Username (optional)<input name="username" defaultValue={settings.username} maxLength={320} autoComplete="off" /></label>
            <label>Password (optional)
              <input name="password" type="password" placeholder={settings.hasPassword ? "Saved — leave blank to keep" : "Enter SMTP password"} maxLength={4096} autoComplete="new-password" />
            </label>
          </div>
          <p className="muted small">Port 465 uses implicit TLS. Other ports require STARTTLS. A username requires a password. Leave a saved password blank only when the host, port, and username are unchanged. Saved passwords are encrypted and never shown again.</p>
          <button className="settings-save-button" type="submit">Save email settings</button>
        </form>
      </section>

      <section className="surface surface-panel">
        <h2>Test delivery</h2>
        <p className="muted">Send a test message to your current account address: {admin.email}</p>
        <div className="row-actions">
          <form action={sendSmtpTestAction}>
            <input type="hidden" name="csrf" value={csrf} />
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
