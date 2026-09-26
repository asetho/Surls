"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";

type Provider = { key: string; label: string };

type ExternalConnectFormProps = {
  csrf: string;
  provider: Provider;
  currentEmail: string;
  totpEnabled: boolean;
  emailCodeAvailable: boolean;
  verificationProviders: Provider[];
};

export function ExternalConnectForm({ csrf, provider, currentEmail, totpEnabled, emailCodeAvailable, verificationProviders }: ExternalConnectFormProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [sendError, setSendError] = useState(false);
  const action = `/api/auth/external/${encodeURIComponent(provider.key)}`;

  async function sendCode() {
    setSending(true);
    setMessage("");
    setSendError(false);
    try {
      const body = new FormData();
      body.set("csrf", csrf);
      body.set("purpose", "send-connect-code");
      const response = await fetch(action, { method: "POST", body, credentials: "same-origin" });
      if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("The form expired. Refresh and try again.");
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok || !result.message) throw new Error(result.error || "Could not send a verification code.");
      setCodeSent(true);
      setMessage(result.message);
    } catch (error) {
      setSendError(true);
      setMessage(error instanceof Error ? error.message : "Could not send a verification code.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button className="secondary" type="button" onClick={() => dialogRef.current?.showModal()}>Connect</button>
      <dialog className="modal-dialog profile-verification-dialog" ref={dialogRef}
        onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
        <div className="modal-panel form-stack">
          <div className="modal-header">
            <div>
              <h2>Connect {provider.label}</h2>
              <p className="muted small">Verify your existing Surls account before connecting this sign-in provider.</p>
            </div>
            <button className="icon-button secondary" type="button" onClick={() => dialogRef.current?.close()} aria-label="Close connection dialog"><X size={16} aria-hidden /></button>
          </div>

          {totpEnabled ? (
            <form className="form-stack" action={action} method="post">
              <input type="hidden" name="csrf" value={csrf} />
              <input type="hidden" name="purpose" value="connect" />
              <input type="hidden" name="method" value="totp" />
              <label>Current authenticator code
                <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required />
              </label>
              <button type="submit">Verify and connect</button>
            </form>
          ) : (
            <>
              <form className="form-stack" action={action} method="post">
                <input type="hidden" name="csrf" value={csrf} />
                <input type="hidden" name="purpose" value="connect" />
                <input type="hidden" name="method" value="password" />
                <label>Current Surls password
                  <input name="password" type="password" autoComplete="current-password" required />
                </label>
                <button type="submit">Verify and connect</button>
              </form>
              {emailCodeAvailable ? (
                <div className="form-stack">
                  <p className="muted small">Or use a code sent to your current email, {currentEmail}.</p>
                  <button className="secondary" type="button" onClick={sendCode} disabled={sending}>{sending ? "Sending..." : codeSent ? "Send a new code" : "Send email code"}</button>
                  {message ? <p className={sendError ? "alert" : "success small"} role="status">{message}</p> : null}
                  {codeSent ? (
                    <form className="form-stack" action={action} method="post">
                      <input type="hidden" name="csrf" value={csrf} />
                      <input type="hidden" name="purpose" value="connect" />
                      <input type="hidden" name="method" value="email" />
                      <label>Email verification code
                        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required />
                      </label>
                      <button type="submit">Verify and connect</button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </>
          )}

          {verificationProviders.length ? (
            <div className="form-stack">
              <p className="muted small">Or verify with an account already connected to Surls.</p>
              <div className="row-actions">
                {verificationProviders.map((linked) => (
                  <form action={`/api/auth/external/${encodeURIComponent(linked.key)}`} method="post" key={linked.key}>
                    <input type="hidden" name="csrf" value={csrf} />
                    <input type="hidden" name="purpose" value="verify-connect" />
                    <input type="hidden" name="targetProvider" value={provider.key} />
                    <button className="secondary" type="submit">Verify with {linked.label}</button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
