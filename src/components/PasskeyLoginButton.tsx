"use client";

import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { KeyRound } from "lucide-react";
import { useState } from "react";

export function PasskeyLoginButton({ nextPath }: { nextPath: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithPasskey() {
    setPending(true);
    setError(null);
    try {
      if (!browserSupportsWebAuthn()) {
        throw new Error("This browser does not support passkeys.");
      }

      const optionsResponse = await fetch("/api/auth/passkey/auth/options", { method: "POST" });
      const options = await optionsResponse.json();
      if (!optionsResponse.ok) throw new Error(options.error || "Could not start passkey login.");

      const authentication = await startAuthentication({ optionsJSON: options });
      const verifyResponse = await fetch("/api/auth/passkey/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next: nextPath, response: authentication })
      });
      const result = await verifyResponse.json();
      if (!verifyResponse.ok) throw new Error(result.error || "Could not verify that passkey.");

      window.location.assign(result.redirectTo || "/admin");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Passkey login failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="form-stack">
      <button className="secondary" type="button" onClick={signInWithPasskey} disabled={pending}>
        <KeyRound size={16} aria-hidden />
        {pending ? "Waiting for passkey..." : "Sign in with passkey"}
      </button>
      {error ? <div className="alert">{error}</div> : null}
    </div>
  );
}
