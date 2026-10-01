"use client";

import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { KeyRound, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { removePasskeyAction } from "@/app/admin/profile/actions";
import { dispatchAdminToast } from "@/lib/admin-toast-event";

type PasskeyItem = {
  backedUp: boolean;
  createdAt: string;
  id: string;
  lastUsedAt: string | null;
  name: string;
};

const PASSKEY_NAME_PLACEHOLDER = "iCloud Keychain, 1Password, Bitwarden, Google Password Manager";

function initialPasskeySupport() {
  return typeof window === "undefined" ? null : browserSupportsWebAuthn();
}

export function PasskeyManager({ csrf, passkeys, totpEnabled, verificationProviders, providerProofAction, providerProofResourceId }: {
  csrf: string; passkeys: PasskeyItem[]; totpEnabled: boolean;
  verificationProviders: { key: string; label: string }[];
  providerProofAction: string | null; providerProofResourceId: string | null;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const removeDialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const removeTitleId = useId();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(providerProofAction === "passkey-remove" ? providerProofResourceId : null);
  const [removeState, removeAction, removePending] = useActionState(removePasskeyAction, null);
  const [error, setError] = useState("");
  const [supportsPasskeys] = useState<boolean | null>(initialPasskeySupport);
  const [pending, setPending] = useState(false);
  const addProviderVerified = providerProofAction === "passkey-add";
  const removeProviderVerified = providerProofAction === "passkey-remove" && providerProofResourceId === removeId;

  useEffect(() => {
    if (providerProofAction === "passkey-remove" && providerProofResourceId && passkeys.some((item) => item.id === providerProofResourceId)) {
      removeDialogRef.current?.showModal();
    }
  }, [providerProofAction, providerProofResourceId, passkeys]);

  useEffect(() => {
    if (removeState?.removed) {
      removeDialogRef.current?.close();
      dispatchAdminToast("success", "Passkey removed.");
      router.refresh();
    }
  }, [removeState, router]);

  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    setError("");
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeDialog() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
    setPassword("");
    setCode("");
    setError("");
  }

  async function registerPasskey() {
    setError("");
    setPending(true);
    try {
      if (!browserSupportsWebAuthn()) {
        throw new Error("This browser does not support passkeys. Use a browser with WebAuthn support to add one.");
      }

      const optionsResponse = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csrf, name, method: addProviderVerified ? "provider" : totpEnabled ? "totp" : "password", code, password })
      });
      const options = await optionsResponse.json();
      if (!optionsResponse.ok) throw new Error(options.error || "Could not start passkey setup.");

      const registration = await startRegistration({ optionsJSON: options });
      const verifyResponse = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csrf, name, response: registration })
      });
      const result = await verifyResponse.json();
      if (!verifyResponse.ok) throw new Error(result.error || "Could not save that passkey.");

      dispatchAdminToast("success", "Passkey added.");
      closeDialog();
      setName("");
      router.refresh();
    } catch (registrationError) {
      setError(registrationError instanceof Error ? registrationError.message : "Passkey setup failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="form-stack">
      <div className="form-grid">
        <label>
          Passkey name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder={PASSKEY_NAME_PLACEHOLDER}
          />
        </label>
      </div>
      <button className="icon-button" type="button" onClick={openDialog} disabled={supportsPasskeys === false}>
        <KeyRound size={16} aria-hidden />
        Add passkey
      </button>
      {addProviderVerified ? <p className="success small">Linked provider verified. Enter a passkey name, then select Add passkey.</p> : null}
      <dialog
        className="modal-dialog profile-security-dialog"
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === event.currentTarget && !pending) closeDialog();
        }}
        onClose={() => {
          setPassword("");
          setCode("");
          setError("");
        }}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <div className="modal-panel delete-modal-panel">
          <div className="modal-header">
            <div>
              <h2 id={titleId}>Add passkey</h2>
              <p className="muted small">{totpEnabled ? "Verify with your authenticator before registering a passkey." : "Confirm your identity before registering a passkey."}</p>
            </div>
            <button type="button" className="icon-button secondary" onClick={closeDialog} disabled={pending} aria-label="Close add passkey dialog">
              <X size={16} aria-hidden />
            </button>
          </div>
          <form className="form-stack" onSubmit={(event) => {
            event.preventDefault();
            void registerPasskey();
          }}>
            {!addProviderVerified ? <label>
              {totpEnabled ? "Current authenticator code" : "Current password"}
              <input value={totpEnabled ? code : password}
                onChange={(event) => totpEnabled ? setCode(event.target.value) : setPassword(event.target.value)}
                type={totpEnabled ? "text" : "password"} inputMode={totpEnabled ? "numeric" : undefined}
                autoComplete={totpEnabled ? "one-time-code" : "current-password"}
                pattern={totpEnabled ? "[0-9]{6}" : undefined} autoFocus required />
            </label> : <p className="success small">Linked provider verified. Continue to register your named passkey.</p>}
            {error ? <p className="alert" role="alert">{error}</p> : null}
            <div className="row-actions">
              <button className="icon-button" type="submit" disabled={pending}>
                <KeyRound size={16} aria-hidden />
                {pending ? "Waiting..." : "Add passkey"}
              </button>
              <button className="secondary" type="button" onClick={closeDialog} disabled={pending}>Cancel</button>
            </div>
          </form>
          {verificationProviders.length ? <div className="profile-provider-verification">
            <p className="muted small">Or verify with a linked provider.</p>
            <div className="row-actions">{verificationProviders.map((provider) => <form action={`/api/auth/external/${provider.key}`} method="post" key={provider.key}>
              <input type="hidden" name="csrf" value={csrf} />
              <input type="hidden" name="purpose" value="reauth" />
              <input type="hidden" name="verificationAction" value="passkey-add" />
              <button className="secondary" type="submit">Verify with {provider.label}</button>
            </form>)}</div>
          </div> : null}
        </div>
      </dialog>
      {supportsPasskeys === false ? (
        <div className="alert">This browser does not support passkeys. Use a browser with WebAuthn support to add one.</div>
      ) : null}
      {passkeys.length ? (
        <div className="passkey-list">
          {passkeys.map((passkey) => (
            <div className="passkey-row" key={passkey.id}>
              <div>
                <strong>{passkey.name}</strong>
                <div className="muted small">
                  Added {passkey.createdAt}
                  {passkey.lastUsedAt ? ` · Last used ${passkey.lastUsedAt}` : ""}
                  {passkey.backedUp ? " · Synced" : ""}
                </div>
              </div>
              <button className="danger icon-button" type="button" onClick={() => { setRemoveId(passkey.id); removeDialogRef.current?.showModal(); }}>
                  <Trash2 size={16} aria-hidden />
                  Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No passkeys registered.</p>
      )}
      <dialog className="modal-dialog profile-security-dialog" ref={removeDialogRef} aria-labelledby={removeTitleId}
        onClick={(event) => { if (event.target === event.currentTarget && !removePending) event.currentTarget.close(); }}>
        <div className="modal-panel delete-modal-panel">
          <div className="modal-header"><div><h2 id={removeTitleId}>Remove passkey</h2>
            <p className="muted small">Verify your identity to remove {passkeys.find((item) => item.id === removeId)?.name ?? "this passkey"}.</p></div>
            <button className="icon-button secondary" type="button" aria-label="Close remove passkey dialog" onClick={() => removeDialogRef.current?.close()}><X size={16} aria-hidden /></button>
          </div>
          <form className="form-stack" action={removeAction}>
            <input type="hidden" name="csrf" value={csrf} />
            <input type="hidden" name="id" value={removeId ?? ""} />
            <input type="hidden" name="method" value={removeProviderVerified ? "provider" : totpEnabled ? "totp" : "password"} />
            {!removeProviderVerified ? <label>{totpEnabled ? "Current authenticator code" : "Current password"}
              <input name={totpEnabled ? "code" : "password"} type={totpEnabled ? "text" : "password"}
                inputMode={totpEnabled ? "numeric" : undefined} autoComplete={totpEnabled ? "one-time-code" : "current-password"}
                pattern={totpEnabled ? "[0-9]{6}" : undefined} required />
            </label> : <p className="success small">Linked provider verified.</p>}
            {removeState?.error ? <p className="alert" role="alert">{removeState.error}</p> : null}
            <div className="row-actions"><button className="danger" type="submit" disabled={removePending}>Remove passkey</button>
              <button className="secondary" type="button" onClick={() => removeDialogRef.current?.close()}>Cancel</button></div>
          </form>
          {verificationProviders.length ? <div className="profile-provider-verification"><p className="muted small">Or verify with a linked provider.</p>
            <div className="row-actions">{verificationProviders.map((provider) => <form action={`/api/auth/external/${provider.key}`} method="post" key={provider.key}>
              <input type="hidden" name="csrf" value={csrf} /><input type="hidden" name="purpose" value="reauth" />
              <input type="hidden" name="verificationAction" value="passkey-remove" />
              <input type="hidden" name="resourceId" value={removeId ?? ""} />
              <button className="secondary" type="submit">Verify with {provider.label}</button>
            </form>)}</div></div> : null}
        </div>
      </dialog>
    </div>
  );
}
