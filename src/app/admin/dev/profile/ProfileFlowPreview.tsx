"use client";

import Link from "next/link";
import { Copy, Download } from "lucide-react";
import { useId, useRef, useState } from "react";

type ProfileAction = "email" | "enableTotp" | "disableTotp" | "backup" | "deleteBackup" | "addPasskey" | "removePasskey" | "connectProvider";
type VerificationStep = "code" | "identity" | "provider" | "setupTotp" | "saveCodes" | "device" | "complete" | "blocked";
type ProfileOptions = {
  emailCodeAvailable: boolean;
  hasPasskey: boolean;
  linkedProvider: boolean;
  passwordAvailable: boolean;
  totpEnabled: boolean;
};

const actionTitles: Record<ProfileAction, string> = {
  email: "Verify your email change",
  enableTotp: "Enable TOTP",
  disableTotp: "Disable TOTP",
  backup: "Generate backup codes",
  deleteBackup: "Delete backup codes",
  addPasskey: "Add passkey",
  removePasskey: "Remove passkey",
  connectProvider: "Connect external sign-in"
};

const sampleBackupCodes = ["PREVIEW-ONLY-01", "PREVIEW-ONLY-02"];
const sampleBackupCodesText = sampleBackupCodes.join("\n");

export function ProfileFlowPreview({
  currentEmail,
  initial,
  name,
  providerName
}: {
  currentEmail: string;
  initial: ProfileOptions;
  name: string;
  providerName: string;
}) {
  const [options, setOptions] = useState(initial);
  const [savedEmail, setSavedEmail] = useState(currentEmail);
  const [email, setEmail] = useState(currentEmail);
  const [displayName, setDisplayName] = useState(name);
  const [passkeyName, setPasskeyName] = useState("");
  const [backupCount, setBackupCount] = useState(initial.totpEnabled ? 10 : 0);
  const [action, setAction] = useState<ProfileAction | null>(null);
  const [step, setStep] = useState<VerificationStep>("code");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codesSaved, setCodesSaved] = useState(false);
  const [codesExportMessage, setCodesExportMessage] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleId = useId();

  function closeDialog() {
    dialogRef.current?.close();
    setAction(null);
    setError("");
    setCode("");
    setPassword("");
    setCodesExportMessage("");
  }

  function reset() {
    closeDialog();
    setOptions(initial);
    setSavedEmail(currentEmail);
    setEmail(currentEmail);
    setDisplayName(name);
    setPasskeyName("");
    setBackupCount(initial.totpEnabled ? 10 : 0);
    setCodesSaved(false);
    setCodesExportMessage("");
    setMessage("");
  }

  function setOption(option: keyof ProfileOptions, checked: boolean) {
    closeDialog();
    setOptions((current) => ({ ...current, [option]: checked }));
    if (option === "totpEnabled" && !checked) setBackupCount(0);
    if (option === "totpEnabled" && checked && backupCount === 0) setBackupCount(10);
    setMessage("");
  }

  function openAction(nextAction: ProfileAction) {
    setAction(nextAction);
    if (options.linkedProvider) setStep("provider");
    else if (options.totpEnabled) setStep("code");
    else setStep(options.emailCodeAvailable && options.passwordAvailable ? "code" : "blocked");
    setCode("");
    setPassword("");
    setCodesSaved(false);
    setCodesExportMessage("");
    setError("");
    setMessage("");
    dialogRef.current?.showModal();
  }

  function saveProfile() {
    if (!email.trim() || !email.includes("@")) {
      setMessage("Enter a sample email address before saving.");
      return;
    }
    if (email.trim().toLowerCase() === savedEmail.toLowerCase()) {
      setMessage("Profile saved in this preview. No account data changed.");
      return;
    }
    openAction("email");
  }

  function finishAction() {
    if (!action) return;
    if (action === "enableTotp") {
      setStep("setupTotp");
    } else if (action === "backup") {
      setStep("saveCodes");
    } else if (action === "addPasskey") {
      setStep("device");
    } else if (action === "connectProvider") {
      setStep("provider");
    } else {
      if (action === "email") setSavedEmail(email.trim());
      if (action === "disableTotp") {
        setOptions((current) => ({ ...current, totpEnabled: false }));
        setBackupCount(0);
      }
      if (action === "deleteBackup") setBackupCount(0);
      if (action === "removePasskey") setOptions((current) => ({ ...current, hasPasskey: false }));
      setStep("complete");
    }
  }

  function verifyCode() {
    if (!/^\d{6}$/.test(code)) {
      setError("Enter any six digits to continue the preview.");
      return;
    }
    setError("");
    setCode("");
    if (options.totpEnabled) finishAction();
    else setStep(options.passwordAvailable ? "identity" : "blocked");
  }

  function verifyPassword() {
    if (!password) {
      setError("Enter a sample password to continue.");
      return;
    }
    setPassword("");
    setError("");
    finishAction();
  }

  function confirmCodes() {
    if (!codesSaved) return;
    setBackupCount(10);
    if (action === "enableTotp") setOptions((current) => ({ ...current, totpEnabled: true }));
    setStep("complete");
  }

  async function copySampleBackupCodes() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(sampleBackupCodesText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = sampleBackupCodesText;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.top = "-1000px";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("Copy command failed.");
      }
      setCodesExportMessage("Sample backup codes copied.");
    } catch {
      setCodesExportMessage("Could not copy sample codes. Select and copy them manually.");
    }
  }

  function downloadSampleBackupCodes() {
    const contents = [
      "Surls profile verification preview",
      "These sample backup codes cannot be used to sign in.",
      "",
      sampleBackupCodesText,
      ""
    ].join("\n");
    const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "surls-preview-backup-codes.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setCodesExportMessage("Sample backup codes download started.");
  }

  return (
    <div className="admin-dev-preview dev-preview-page">
      <nav className="login-dev-toolbar" aria-label="Development previews">
        <strong>hmserv dev · Profile flow</strong>
        <Link href="/admin/dev">Previews</Link>
        <Link href="/admin/dev/login">Login flow</Link>
        <Link href="/admin/profile">Real profile</Link>
      </nav>
      <main className="dev-preview-main admin-content">
        <div className="content-header">
          <h1>Profile verification preview</h1>
          <p className="muted">Test how sensitive profile actions would ask for proof of identity. This page never changes your account or sends email.</p>
        </div>
        <section className="login-flow-controls profile-dev-controls surface" aria-label="Profile verification settings">
          <div className="login-flow-controls-heading">
            <div>
              <h2>Test a verification scenario</h2>
              <p className="muted small">hmserv development preview only. Changing these switches affects this page only.</p>
            </div>
            <button className="secondary" type="button" onClick={reset}>Reset scenario</button>
          </div>
          <div className="login-flow-switches">
            <label><input type="checkbox" checked={options.totpEnabled} onChange={(event) => setOption("totpEnabled", event.currentTarget.checked)} /> TOTP enabled</label>
            <label><input type="checkbox" checked={options.emailCodeAvailable} onChange={(event) => setOption("emailCodeAvailable", event.currentTarget.checked)} /> Current email reachable</label>
            <label><input type="checkbox" checked={options.passwordAvailable} onChange={(event) => setOption("passwordAvailable", event.currentTarget.checked)} /> Account password available</label>
            <label><input type="checkbox" checked={options.linkedProvider} onChange={(event) => setOption("linkedProvider", event.currentTarget.checked)} /> Linked external provider</label>
            <label><input type="checkbox" checked={options.hasPasskey} onChange={(event) => setOption("hasPasskey", event.currentTarget.checked)} /> Passkey registered</label>
          </div>
          <p className="muted small login-flow-note">A linked provider verifies you first. Without one, use an authenticator code when TOTP is enabled, or a code to the current email plus a password.</p>
        </section>
        {message ? <p className="success" role="status">{message}</p> : null}
        <section className="surface surface-panel profile-card">
          <h2>Account information</h2>
          <div className="form-grid">
            <label>Display name<input type="text" autoComplete="off" value={displayName} onChange={(event) => setDisplayName(event.currentTarget.value)} /></label>
            <label>Email<input type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.currentTarget.value)} /></label>
          </div>
          <p className="muted small">Changing the email opens verification after Save profile. No code is sent in this preview.</p>
          <button className="profile-save-button" type="button" onClick={saveProfile}>Save profile</button>
        </section>
        <section className="surface surface-panel profile-dev-security">
          <h2>Security</h2>
          <section className="profile-security-panel">
            <div className="profile-security-section-heading"><h3>TOTP 2FA</h3><span className={`status-pill ${options.totpEnabled ? "status-pill-active" : ""}`}>{options.totpEnabled ? "Enabled" : "Not enabled"}</span></div>
            <button className={options.totpEnabled ? "danger" : ""} type="button" onClick={() => openAction(options.totpEnabled ? "disableTotp" : "enableTotp")}>{options.totpEnabled ? "Disable TOTP" : "Set up TOTP"}</button>
          </section>
          <section className="profile-security-panel">
            <h3>Backup codes</h3>
            <p className="muted">You have {backupCount} unused backup codes in this scenario.</p>
            {options.totpEnabled ? (
              <div className="row-actions">
                <button type="button" onClick={() => openAction("backup")}>{backupCount ? "Regenerate backup codes" : "Generate backup codes"}</button>
                {backupCount > 0 ? <button className="danger-outline" type="button" onClick={() => openAction("deleteBackup")}>Delete backup codes</button> : null}
              </div>
            ) : <p className="muted small">Enable TOTP to generate backup codes.</p>}
          </section>
          <section className="profile-security-panel">
            <h3>Passkeys</h3>
            <p className="muted">Register a device passkey for passwordless sign-in.</p>
            <label className="profile-dev-passkey-name">Passkey name<input type="text" autoComplete="off" value={passkeyName} onChange={(event) => setPasskeyName(event.currentTarget.value)} placeholder="iCloud Keychain, 1Password, Bitwarden" /></label>
            <button type="button" onClick={() => openAction("addPasskey")}>Add passkey</button>
            {options.hasPasskey ? <div className="profile-dev-passkey-row"><span>{passkeyName || "Sample passkey"}</span><button className="danger" type="button" onClick={() => openAction("removePasskey")}>Remove</button></div> : <p className="muted small">No passkeys registered in this scenario.</p>}
          </section>
          <section className="profile-security-panel">
            <h3>External sign-in</h3>
            <p className="muted">{options.linkedProvider ? `${providerName} is connected in this scenario.` : "No provider is connected in this scenario."}</p>
            {!options.linkedProvider ? <button className="secondary" type="button" onClick={() => openAction("connectProvider")}>Connect {providerName}</button> : null}
          </section>
        </section>
      </main>
      <dialog className="modal-dialog profile-security-dialog" ref={dialogRef} aria-labelledby={dialogTitleId} onClose={() => setAction(null)} onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
        <div className="modal-panel">
          <div className="modal-header">
            <div><h2 id={dialogTitleId}>{action ? actionTitles[action] : "Verify action"}</h2><p className="muted small">Preview only. Enter sample values; nothing is checked or sent.</p></div>
            <button className="icon-button secondary" type="button" onClick={closeDialog} aria-label="Close verification dialog">×</button>
          </div>
          {error ? <p className="alert" role="alert">{error}</p> : null}
          {step === "code" ? (
            <div className="form-stack">
              <p className="muted small">{options.totpEnabled ? "Enter a current authenticator code." : `A six-digit code would be sent to your current email, ${savedEmail}. No email is sent in this preview.`}</p>
              <label>{options.totpEnabled ? "Current authenticator code" : "Email verification code"}<input type="text" inputMode="numeric" autoComplete="off" value={code} onChange={(event) => setCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" /></label>
              <button type="button" onClick={verifyCode}>Continue</button>
            </div>
          ) : null}
          {step === "identity" ? (
            <div className="form-stack">
              <p className="muted small">Confirm your identity again before this change.</p>
              {options.passwordAvailable ? <><label>Current password<input type="password" autoComplete="off" value={password} onChange={(event) => setPassword(event.currentTarget.value)} placeholder="Sample password" /></label><button type="button" onClick={verifyPassword}>Verify password</button></> : null}
            </div>
          ) : null}
          {step === "provider" ? (
            <div className="form-stack">
              <p className="muted small">A real flow would send you to {providerName} and return after a fresh sign-in.</p>
              <button type="button" onClick={() => { if (action === "connectProvider") { setOptions((current) => ({ ...current, linkedProvider: true })); setStep("complete"); } else finishAction(); }}>Complete provider verification</button>
            </div>
          ) : null}
          {step === "setupTotp" ? (
            <div className="form-stack">
              <p className="muted">In a real flow, scan an authenticator QR code, then enter its current code. This preview does not create a secret.</p>
              <label>New authenticator code<input type="text" inputMode="numeric" autoComplete="off" value={code} onChange={(event) => setCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" /></label>
              <button type="button" onClick={() => { if (!/^\d{6}$/.test(code)) { setError("Enter any six digits to continue the preview."); return; } setError(""); setCode(""); setStep("saveCodes"); }}>Continue to backup codes</button>
            </div>
          ) : null}
          {step === "saveCodes" ? (
            <div className="form-stack">
              <p className="muted">Sample backup codes are shown only for this preview. Save and confirm them to finish.</p>
              <div className="profile-dev-sample-codes">
                <div className="profile-dev-sample-code-list">
                  {sampleBackupCodes.map((sampleCode) => <code key={sampleCode}>{sampleCode}</code>)}
                </div>
                <div className="profile-dev-sample-code-actions">
                  <button className="secondary icon-button icon-only-action" type="button" onClick={copySampleBackupCodes} aria-label="Copy sample backup codes" title="Copy sample backup codes"><Copy size={16} aria-hidden /></button>
                  <button className="secondary icon-button icon-only-action" type="button" onClick={downloadSampleBackupCodes} aria-label="Download sample backup codes as text" title="Download sample backup codes as text"><Download size={16} aria-hidden /></button>
                </div>
              </div>
              {codesExportMessage ? <p className="muted small profile-dev-export-feedback" role="status">{codesExportMessage}</p> : null}
              <label className="profile-dev-confirm"><input type="checkbox" checked={codesSaved} onChange={(event) => setCodesSaved(event.currentTarget.checked)} /> I saved these sample backup codes</label>
              <button type="button" disabled={!codesSaved} onClick={confirmCodes}>Finish</button>
            </div>
          ) : null}
          {step === "device" ? (
            <div className="form-stack"><p className="muted">A real flow would now ask your device to create a passkey.</p><button type="button" onClick={() => { setOptions((current) => ({ ...current, hasPasskey: true })); setStep("complete"); }}>Complete simulated device check</button></div>
          ) : null}
          {step === "blocked" ? <p className="alert" role="alert">This action cannot continue in the selected scenario. When TOTP is off, link an external provider or use a code to the current email plus a password.</p> : null}
          {step === "complete" ? <p className="success" role="status">{action ? actionTitles[action] : "Action"} completed in this preview. Your real account was not changed.</p> : null}
          <div className="row-actions"><button className="secondary" type="button" onClick={closeDialog}>{step === "complete" ? "Close" : "Cancel"}</button></div>
        </div>
      </dialog>
    </div>
  );
}
