"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { SmtpSettingsSummary } from "@/lib/smtp-settings";
import { checkSmtpConnectionAction, saveSmtpSettingsAction } from "./actions";

export function SmtpSettingsForm({ csrf, settings }: { csrf: string; settings: SmtpSettingsSummary }) {
  const form = useRef<HTMLFormElement>(null);
  const revision = useRef(0);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [checked, setChecked] = useState<{ proof: string; expiresAt: number } | null>(null);
  const [useLogin, setUseLogin] = useState(Boolean(settings.username) || settings.source === "none");

  useEffect(() => {
    if (!checked) return;
    const timeout = window.setTimeout(() => {
      setChecked(null);
      setResult({ ok: false, message: "The check expired. Check these settings again before saving." });
    }, Math.max(0, checked.expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [checked]);

  function invalidateCheck() {
    revision.current += 1;
    setChecked(null);
    setResult(null);
  }

  function checkConnection() {
    if (!form.current?.reportValidity()) return;
    const data = new FormData(form.current);
    invalidateCheck();
    const checkedRevision = revision.current;
    startTransition(async () => {
      try {
        const response = await checkSmtpConnectionAction(data);
        if (revision.current !== checkedRevision) return;
        setResult(response);
        setChecked(response.ok && response.proof && response.expiresAt
          ? { proof: response.proof, expiresAt: response.expiresAt } : null);
      } catch {
        if (revision.current !== checkedRevision) return;
        setResult({ ok: false, message: "Could not check the SMTP connection. Please try again." });
      }
    });
  }

  return (
    <form ref={form} className="form-stack" action={saveSmtpSettingsAction} onInput={invalidateCheck}>
      <input type="hidden" name="csrf" value={csrf} />
      <input type="hidden" name="smtpCheckProof" value={checked?.proof ?? ""} />
      <div className="form-grid">
        <label>SMTP host<input name="host" defaultValue={settings.host} placeholder="smtp.example.com" maxLength={253} autoComplete="off" /></label>
        <label>Port<input name="port" type="number" required min="1" max="65535" defaultValue={settings.port} /></label>
        <label>Sender email (optional if username is an email)<input name="from" type="email" defaultValue={settings.from} placeholder="Uses username when blank" maxLength={320} autoComplete="off" /></label>
        <label>From name (optional)<input name="fromName" defaultValue={settings.fromName} placeholder="Surls" maxLength={100} autoComplete="off" /></label>
        <label className="smtp-auth-toggle"><span><input className="inline-control" type="checkbox" checked={useLogin} onChange={(event) => { setUseLogin(event.target.checked); invalidateCheck(); }} />{" "}Use SMTP login</span></label>
        <label>Username<input name="username" required={useLogin} disabled={!useLogin} defaultValue={settings.username} maxLength={320} autoComplete="off" /></label>
        <label>Password
          <input name="password" type="password" required={useLogin && !settings.hasPassword} disabled={!useLogin} placeholder={settings.hasPassword ? "Saved — leave blank to keep" : "Enter SMTP password"} maxLength={4096} autoComplete="new-password" />
        </label>
      </div>
      <p className="muted small">When SMTP login is selected, enter a username and password. Leave a saved password blank only when the host, port, and username are unchanged. Port 465 uses implicit TLS; other ports require STARTTLS. Saved passwords are encrypted and never shown again.</p>
      <p className="muted small">Check these settings to unlock Save. Changing any field requires another check; a successful check expires after five minutes.</p>
      <div className="row-actions">
        <button className="secondary" type="button" onClick={checkConnection} disabled={pending}>{pending ? "Checking…" : "Check SMTP settings"}</button>
        <button className="settings-save-button" type="submit" disabled={!checked || pending}>Save email settings</button>
      </div>
      {result ? <p role={result.ok ? "status" : "alert"} className="small">{result.message}</p> : null}
    </form>
  );
}
