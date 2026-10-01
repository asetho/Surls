"use client";

import { useActionState, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { PanelLeftOpen, PanelRightOpen, Save, X } from "lucide-react";
import { updateProfileAction } from "@/app/admin/profile/actions";
import { dispatchAdminToast } from "@/lib/admin-toast-event";
import { DEFAULT_MOBILE_MENU_SIDE, normalizeMobileMenuSide } from "@/lib/mobile-menu";
import { TimeZoneSelect } from "./TimeZoneSelect";

type ProfileIdentityFormProps = {
  backupCodeAvailable: boolean;
  csrf: string;
  emailCodeAvailable: boolean;
  emailVerificationProviders: { key: string; label: string }[];
  localLoginEnabled: boolean;
  pendingEmail: string | null;
  providerVerified: boolean;
  siteDefaultTimeZone: string;
  totpEnabled: boolean;
  user: {
    displayTimeZone: string | null;
    email: string;
    mobileMenuSide?: string | null;
    name: string | null;
  };
};

export function ProfileIdentityForm({ backupCodeAvailable, csrf, emailCodeAvailable, emailVerificationProviders, localLoginEnabled, pendingEmail, providerVerified, siteDefaultTimeZone, totpEnabled, user }: ProfileIdentityFormProps) {
  const [state, action, pending] = useActionState(updateProfileAction, null);
  const [email, setEmail] = useState(pendingEmail ?? user.email);
  const [verificationCode, setVerificationCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = useId();
  const titleId = useId();
  const mobileMenuSide = normalizeMobileMenuSide(user.mobileMenuSide ?? DEFAULT_MOBILE_MENU_SIDE);
  const emailChanged = email.trim().toLowerCase() !== user.email.toLowerCase();
  const hasProviderProof = providerVerified && pendingEmail?.toLowerCase() === email.trim().toLowerCase();
  const emailChangeUnavailable = !totpEnabled && !localLoginEnabled && !emailVerificationProviders.length && !hasProviderProof;

  useEffect(() => {
    if (state?.message) {
      dispatchAdminToast("success", state.message);
    }
    if (state?.error) dispatchAdminToast("error", state.error);
  }, [state]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (state?.verificationRequired && !dialog.open) {
      dialog.showModal();
      setDialogOpen(true);
    } else if (state?.message === "Profile updated." && dialog.open) {
      dialog.close();
      setDialogOpen(false);
    }
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (emailChanged && emailChangeUnavailable) {
      event.preventDefault();
      if (!dialogRef.current?.open) { dialogRef.current?.showModal(); setDialogOpen(true); }
      return;
    }
    if (!emailChanged || hasProviderProof || !totpEnabled) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.name === "confirmEmailChange") return;
    event.preventDefault();
    if (!dialogRef.current?.open) {
      dialogRef.current?.showModal();
      setDialogOpen(true);
    }
  }

  return (
    <>
    <form id={formId} className="form-stack" action={action} onSubmit={handleSubmit}>
      <input type="hidden" name="csrf" value={csrf} />
      <div className="form-grid">
        <label>
          Display name
          <input name="name" autoComplete="name" defaultValue={user.name ?? ""} />
        </label>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setVerificationCode(""); }} required />
        </label>
        <TimeZoneSelect
          className="form-field"
          siteDefaultTimeZone={siteDefaultTimeZone}
          value={user.displayTimeZone}
        />
        <fieldset className="profile-mobile-menu-side-field">
          <legend>Mobile menu side</legend>
          <div className="profile-mobile-menu-side-options">
            <label className="profile-mobile-menu-side-option">
              <input
                className="sr-only"
                type="radio"
                name="mobileMenuSide"
                value="left"
                defaultChecked={mobileMenuSide === "left"}
              />
              <span className="profile-mobile-menu-side-option-label">
                <PanelLeftOpen size={16} aria-hidden />
                Left
              </span>
            </label>
            <label className="profile-mobile-menu-side-option">
              <input
                className="sr-only"
                type="radio"
                name="mobileMenuSide"
                value="right"
                defaultChecked={mobileMenuSide === "right"}
              />
              <span className="profile-mobile-menu-side-option-label">
                <PanelRightOpen size={16} aria-hidden />
                Right
              </span>
            </label>
          </div>
        </fieldset>
      </div>
      {emailChanged && hasProviderProof ? <p className="success small">Linked provider verified. {totpEnabled ? "Complete your email change now." : "A code sent to your current email is also required."}</p> : null}
      <div className="profile-meta-row">
        <span className="muted small">Used for sign-in, passkeys, account activity, and timestamp display.</span>
      </div>
      <button className="profile-save-button" type="submit" disabled={pending}>
        <Save size={16} aria-hidden />
        {pending ? "Saving..." : "Save profile"}
      </button>
    </form>
    <dialog
      className="modal-dialog profile-verification-dialog"
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => { setDialogOpen(false); setVerificationCode(""); setUseBackupCode(false); }}
      onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
    >
      <div className="modal-panel">
        <div className="modal-header">
          <div>
            <h2 id={titleId}>Verify your email change</h2>
            <p className="muted small">Your email will change to {email} after verification.</p>
          </div>
          <button type="button" className="icon-button secondary" onClick={() => dialogRef.current?.close()} aria-label="Close verification dialog"><X size={16} aria-hidden /></button>
        </div>
        {state?.error ? <p className="alert" role="alert">{state.error}</p> : null}
        {emailChangeUnavailable ? <p className="alert" role="alert">Changing your email requires a Surls password or a linked sign-in provider. Ask a site administrator to help restore an available verification method.</p> : null}
        {totpEnabled ? (
          <div className="form-stack">
            <label className="form-field">{useBackupCode ? "Unused backup code" : "Current authenticator code"}
              <input form={formId} name="verificationCode" inputMode={useBackupCode ? "text" : "numeric"}
                autoComplete={useBackupCode ? "off" : "one-time-code"} pattern={useBackupCode ? undefined : "[0-9]{6}"}
                value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} required={dialogOpen} />
            </label>
            {backupCodeAvailable ? <button type="button" className="secondary" onClick={() => { setUseBackupCode(!useBackupCode); setVerificationCode(""); }}>
              {useBackupCode ? "Use an authenticator code" : "Use a backup code instead"}
            </button> : null}
          </div>
        ) : emailCodeAvailable ? (
          <>
            <p className="muted small">Enter the six-digit code sent to your current email, {user.email}, and confirm your identity. The code expires in 10 minutes.</p>
            <label className="form-field">Email verification code
              <input form={formId} name="verificationCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} required={dialogOpen} />
            </label>
            {localLoginEnabled && !hasProviderProof ? <label className="form-field">Current Surls password
              <input form={formId} name="password" type="password" autoComplete="current-password" required={dialogOpen} />
            </label> : null}
          </>
        ) : null}
        <div className="row-actions">
          {(totpEnabled || (emailCodeAvailable && (localLoginEnabled || hasProviderProof))) ? <button type="submit" form={formId} name="confirmEmailChange" value="yes" disabled={pending}>Confirm email change</button> : null}
          {!totpEnabled && emailCodeAvailable ? <button type="submit" form={formId} formNoValidate name="resendCode" value="yes" className="secondary" disabled={pending} onClick={() => setVerificationCode("")}>Send a new code</button> : null}
        </div>
        {emailVerificationProviders.length ? (
          <div className="profile-provider-verification">
            <p className="muted small">Or verify with a connected provider.</p>
            <div className="row-actions">
              {emailVerificationProviders.map((provider) => (
                <form action={`/api/auth/external/${provider.key}`} method="post" key={provider.key}>
                  <input type="hidden" name="csrf" value={csrf} />
                  <input type="hidden" name="purpose" value="reauth" />
                  <input type="hidden" name="pendingEmail" value={email} />
                  <button type="submit" className="secondary">Verify with {provider.label}</button>
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
