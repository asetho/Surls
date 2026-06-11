"use client";

import { useState } from "react";

export function TwoFactorLoginForm({
  csrf,
  email,
  error,
  siteName
}: {
  csrf: string;
  email: string;
  error?: string;
  siteName: string;
}) {
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const isBackup = mode === "backup";

  return (
    <form className="surface login-card form-stack" action="/api/auth/login/2fa" method="post">
      <div>
        <h1>Enter your 2FA code</h1>
        <p className="muted">Finish signing in to {siteName} as {email}.</p>
      </div>
      {error ? <div className="alert">{error}</div> : null}
      <input type="hidden" name="csrf" value={csrf} />
      <input type="hidden" name="method" value={mode} />
      {isBackup ? (
        <label>
          Backup code
          <input name="code" autoComplete="one-time-code" required placeholder="XXXXX-XXXXX" />
        </label>
      ) : (
        <label>
          Authenticator code
          <input name="code" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]*" />
        </label>
      )}
      <button type="submit">Continue</button>
      <button className="secondary" type="button" onClick={() => setMode(isBackup ? "totp" : "backup")}>
        {isBackup ? "Use an authenticator code" : "Use a backup code instead"}
      </button>
    </form>
  );
}
