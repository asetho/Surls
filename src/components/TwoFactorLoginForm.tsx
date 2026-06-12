"use client";

import { useState } from "react";

export function TwoFactorLoginForm({
  csrf,
  embedded = false,
  email,
  error,
  siteName
}: {
  csrf: string;
  embedded?: boolean;
  email: string;
  error?: string;
  siteName: string;
}) {
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const isBackup = mode === "backup";
  const title = "Enter your 2FA code";
  const tagline = `Finish signing in to ${siteName} as ${email}.`;

  return (
    <form
      className={`${embedded ? "surls-auth-form-embedded" : "surface login-card"} surls-auth-form form-stack`}
      action="/api/auth/login/2fa"
      method="post"
      data-surls-auth-form
    >
      {!embedded ? (
        <div data-surls-auth-intro>
          <h1>{title}</h1>
          <p className="muted">{tagline}</p>
        </div>
      ) : null}
      {error ? <div className="alert">{error}</div> : null}
      <input type="hidden" name="csrf" value={csrf} />
      <input type="hidden" name="method" value={mode} />
      {isBackup ? (
        <label data-surls-auth-field>
          Backup code
          <input name="code" autoComplete="one-time-code" required placeholder="XXXXX-XXXXX" data-surls-auth-input />
        </label>
      ) : (
        <label data-surls-auth-field>
          Authenticator code
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            pattern="[0-9]*"
            data-surls-auth-input
          />
        </label>
      )}
      <button type="submit" data-surls-auth-submit>
        Continue
      </button>
      <button
        className="secondary"
        type="button"
        onClick={() => setMode(isBackup ? "totp" : "backup")}
        data-surls-auth-secondary
      >
        {isBackup ? "Use an authenticator code" : "Use a backup code instead"}
      </button>
    </form>
  );
}
