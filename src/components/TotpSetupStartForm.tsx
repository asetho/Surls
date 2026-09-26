"use client";

import { X } from "lucide-react";
import { useActionState, useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { sendTotpSetupEmailCodeAction, startTotpAction } from "@/app/admin/profile/actions";

type Provider = { key: string; label: string };

export function TotpSetupStartForm({ csrf, currentEmail, emailCodeAvailable, localLoginEnabled, providerProofReady, verificationProviders }: {
  csrf: string;
  currentEmail: string;
  emailCodeAvailable: boolean;
  localLoginEnabled: boolean;
  providerProofReady: boolean;
  verificationProviders: Provider[];
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [startState, startAction, starting] = useActionState(startTotpAction, null);
  const [emailState, sendEmailAction, sending] = useActionState(sendTotpSetupEmailCodeAction, null);

  useEffect(() => {
    if (providerProofReady && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
  }, [providerProofReady]);

  useEffect(() => {
    if (startState?.started) {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [router, startState?.started]);

  const closeDialog = () => { if (!starting && !sending) dialogRef.current?.close(); };

  return (
    <>
      <button type="button" onClick={() => { if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal(); }}>Start TOTP setup</button>
      <dialog className="modal-dialog profile-security-dialog" ref={dialogRef} aria-labelledby={titleId}
        onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }}
        onCancel={(event) => { if (starting || sending) event.preventDefault(); }}>
        <div className="modal-panel form-stack">
          <div className="modal-header">
            <div>
              <h2 id={titleId}>Start TOTP setup</h2>
              <p className="muted small">Verify your existing account before adding an authenticator.</p>
            </div>
            <button className="icon-button secondary" type="button" onClick={closeDialog} disabled={starting || sending} aria-label="Close TOTP setup dialog"><X size={16} aria-hidden /></button>
          </div>

          {localLoginEnabled ? <form className="form-stack" action={startAction}>
            <input type="hidden" name="csrf" value={csrf} />
            <input type="hidden" name="method" value="password" />
            <label>Current Surls password
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <button type="submit" disabled={starting}>Verify password and continue</button>
          </form> : null}
          {localLoginEnabled && !emailCodeAvailable && !verificationProviders.length && !providerProofReady ?
            <p className="muted small">If this account has no Surls password, ask a site administrator to enable email verification or a linked sign-in provider.</p> : null}

          {emailCodeAvailable ? <div className="form-stack">
            <p className="muted small">Or use a code sent to your current email, {currentEmail}.</p>
            <form action={sendEmailAction}>
              <input type="hidden" name="csrf" value={csrf} />
              <button className="secondary" type="submit" disabled={sending}>{sending ? "Sending..." : emailState?.sent ? "Send a new code" : "Send email code"}</button>
            </form>
            {emailState?.message ? <p className="success small" role="status">{emailState.message}</p> : null}
            {emailState?.error ? <p className="alert" role="alert">{emailState.error}</p> : null}
            {emailState?.sent ? <form className="form-stack" action={startAction}>
              <input type="hidden" name="csrf" value={csrf} />
              <input type="hidden" name="method" value="email" />
              <label>Email verification code
                <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required />
              </label>
              <button type="submit" disabled={starting}>Verify email code and continue</button>
            </form> : null}
          </div> : null}

          {verificationProviders.length ? <div className="form-stack">
            <p className="muted small">Or verify with an account already connected to Surls.</p>
            <div className="row-actions">
              {verificationProviders.map((provider) => <form action={`/api/auth/external/${encodeURIComponent(provider.key)}`} method="post" key={provider.key}>
                <input type="hidden" name="csrf" value={csrf} />
                <input type="hidden" name="purpose" value="verify-totp-setup" />
                <button className="secondary" type="submit">Verify with {provider.label}</button>
              </form>)}
            </div>
          </div> : null}

          {providerProofReady ? <form action={startAction}>
            <input type="hidden" name="csrf" value={csrf} />
            <input type="hidden" name="method" value="provider" />
            <button type="submit" disabled={starting}>Continue after provider verification</button>
          </form> : null}
          {!localLoginEnabled && !emailCodeAvailable && !verificationProviders.length && !providerProofReady ?
            <p className="alert" role="alert">Account verification is unavailable. Ask a site administrator to enable email verification or link a sign-in provider.</p> : null}
          {startState?.error ? <p className="alert" role="alert">{startState.error}</p> : null}
        </div>
      </dialog>
    </>
  );
}
