"use client";

import { useRef, useState, useTransition } from "react";
import type { SmtpSettingsSummary } from "@/lib/smtp-settings";
import { checkSmtpConnectionAction, saveSmtpSettingsAction } from "./actions";

export function SmtpSettingsForm({ csrf, settings }: { csrf: string; settings: SmtpSettingsSummary }) {
  const form = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [useLogin, setUseLogin] = useState(Boolean(settings.username) || settings.source === "none");

  function checkConnection() {
    if (!form.current?.reportValidity()) return;
    const data = new FormData(form.current);
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await checkSmtpConnectionAction(data));
      } catch {
        setResult({ ok: false, message: "Could not check the SMTP connection. Please try again." });
      }
    });
  }

  return (
    <form ref={form} className="form-stack" action={saveSmtpSettingsAction} onInput={() => setResult(null)}>
      <input type="hidden" name="csrf" value={csrf} />
      <div className="form-grid">
        <label>SMTP host<input name="host" defaultValue={settings.host} placeholder="smtp.example.com" maxLength={253} autoComplete="off" /></label>
        <label>Port<input name="port" type="number" required min="1" max="65535" defaultValue={settings.port} /></label>
        <label>Sender email (optional if username is an email)<input name="from" type="email" required={!useLogin} defaultValue={settings.from} placeholder="Uses username when blank" maxLength={320} autoComplete="off" /></label>
        <label>From name (optional)<input name="fromName" defaultValue={settings.fromName} placeholder="Surls" maxLength={100} autoComplete="off" /></label>
        <label className="smtp-auth-toggle"><span><input className="inline-control" type="checkbox" checked={useLogin} onChange={(event) => setUseLogin(event.target.checked)} />{" "}Use SMTP login</span></label>
        <label>Username<input name="username" required={useLogin} disabled={!useLogin} defaultValue={settings.username} maxLength={320} autoComplete="off" /></label>
        <label>Password
          <input name="password" type="password" required={useLogin && !settings.hasPassword} disabled={!useLogin} placeholder={settings.hasPassword ? "Saved — leave blank to keep" : "Enter SMTP password"} maxLength={4096} autoComplete="new-password" />
        </label>
      </div>
      <p className="muted small">When SMTP login is selected, enter a username and password. Leave a saved password blank only when the host, port, and username are unchanged. Port 465 uses implicit TLS; other ports require STARTTLS. Saved passwords are encrypted and never shown again.</p>
      <div className="row-actions">
        <button className="settings-save-button" type="submit">Save email settings</button>
        <button className="secondary" type="button" onClick={checkConnection} disabled={pending}>{pending ? "Checking…" : useLogin ? "Check connection & login" : "Check connection"}</button>
      </div>
      {result ? <p role={result.ok ? "status" : "alert"} className="small">{result.message}</p> : null}
    </form>
  );
}
