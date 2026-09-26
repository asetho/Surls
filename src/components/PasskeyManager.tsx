"use client";

import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { KeyRound, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { removePasskeyAction } from "@/app/admin/profile/actions";
import { dispatchAdminToast } from "@/lib/admin-toast-event";
import { ConfirmButton } from "./ConfirmButton";

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

export function PasskeyManager({ csrf, passkeys }: { csrf: string; passkeys: PasskeyItem[] }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [supportsPasskeys] = useState<boolean | null>(initialPasskeySupport);
  const [pending, setPending] = useState(false);

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
        body: JSON.stringify({ csrf, name, password })
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
      <dialog
        className="modal-dialog profile-security-dialog"
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === event.currentTarget && !pending) closeDialog();
        }}
        onClose={() => {
          setPassword("");
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
              <p className="muted small">Confirm your current password before registering a passkey.</p>
            </div>
            <button type="button" className="icon-button secondary" onClick={closeDialog} disabled={pending} aria-label="Close add passkey dialog">
              <X size={16} aria-hidden />
            </button>
          </div>
          <form className="form-stack" onSubmit={(event) => {
            event.preventDefault();
            void registerPasskey();
          }}>
            <label>
              Current password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                autoFocus
                required
              />
            </label>
            {error ? <p className="alert" role="alert">{error}</p> : null}
            <div className="row-actions">
              <button className="icon-button" type="submit" disabled={pending}>
                <KeyRound size={16} aria-hidden />
                {pending ? "Waiting..." : "Add passkey"}
              </button>
              <button className="secondary" type="button" onClick={closeDialog} disabled={pending}>Cancel</button>
            </div>
          </form>
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
              <form action={removePasskeyAction}>
                <input type="hidden" name="csrf" value={csrf} />
                <input type="hidden" name="id" value={passkey.id} />
                <ConfirmButton className="danger icon-button" type="submit" message={`Remove passkey ${passkey.name}?`}>
                  <Trash2 size={16} aria-hidden />
                  Remove
                </ConfirmButton>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No passkeys registered.</p>
      )}
    </div>
  );
}
