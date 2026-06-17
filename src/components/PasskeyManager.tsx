"use client";

import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { KeyRound, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  const [name, setName] = useState("");
  const [supportsPasskeys] = useState<boolean | null>(initialPasskeySupport);
  const [pending, setPending] = useState(false);

  async function registerPasskey() {
    setPending(true);
    try {
      if (!browserSupportsWebAuthn()) {
        throw new Error("This browser does not support passkeys. Use a browser with WebAuthn support to add one.");
      }

      const optionsResponse = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csrf, name })
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
      setName("");
      router.refresh();
    } catch (registrationError) {
      dispatchAdminToast(
        "error",
        registrationError instanceof Error ? registrationError.message : "Passkey setup failed."
      );
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
        <div className="field-action">
          <button type="button" onClick={registerPasskey} disabled={pending || supportsPasskeys === false}>
            <KeyRound size={16} aria-hidden />
            {pending ? "Waiting..." : "Add passkey"}
          </button>
        </div>
      </div>
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
