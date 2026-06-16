"use client";

import { type ClipboardEvent, type KeyboardEvent, useId, useRef, useState } from "react";

const TOTP_CODE_LENGTH = 6;

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function TotpCodeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const labelId = useId();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: TOTP_CODE_LENGTH }, (_, index) => value[index] ?? "");

  function focusInput(index: number) {
    inputRefs.current[index]?.focus();
    inputRefs.current[index]?.select();
  }

  function setDigitRange(startIndex: number, rawValue: string) {
    const incomingDigits = digitsOnly(rawValue).slice(0, TOTP_CODE_LENGTH - startIndex);
    const nextDigits = [...digits];

    if (!incomingDigits) {
      nextDigits[startIndex] = "";
      onChange(nextDigits.join(""));
      return;
    }

    incomingDigits.split("").forEach((digit, offset) => {
      nextDigits[startIndex + offset] = digit;
    });
    onChange(nextDigits.join(""));
    focusInput(Math.min(startIndex + incomingDigits.length, TOTP_CODE_LENGTH - 1));
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      const nextDigits = [...digits];
      if (nextDigits[index]) {
        nextDigits[index] = "";
        onChange(nextDigits.join(""));
        return;
      }
      if (index > 0) {
        nextDigits[index - 1] = "";
        onChange(nextDigits.join(""));
        focusInput(index - 1);
      }
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      const nextDigits = [...digits];
      nextDigits[index] = "";
      onChange(nextDigits.join(""));
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusInput(index - 1);
      return;
    }

    if (event.key === "ArrowRight" && index < TOTP_CODE_LENGTH - 1) {
      event.preventDefault();
      focusInput(index + 1);
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    setDigitRange(index, event.clipboardData.getData("text"));
  }

  return (
    <div className="totp-code-field" data-surls-auth-field>
      <div className="totp-code-label" id={labelId}>
        Authenticator code
      </div>
      <input type="hidden" name="code" readOnly value={value} />
      <div className="totp-code-inputs" role="group" aria-labelledby={labelId} data-surls-auth-code-inputs>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputRefs.current[index] = element;
            }}
            aria-label={`Authenticator code digit ${index + 1}`}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            className="totp-code-input"
            data-surls-auth-input
            inputMode="numeric"
            maxLength={TOTP_CODE_LENGTH}
            onChange={(event) => setDigitRange(index, event.currentTarget.value)}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            pattern="[0-9]*"
            required
            type="text"
            value={digit}
          />
        ))}
      </div>
    </div>
  );
}

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
  const [totpCode, setTotpCode] = useState("");
  const isBackup = mode === "backup";
  const title = "Enter your 2FA code";

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
          <p className="muted">
            Finish signing in to {siteName} as
            <span className="auth-account-line">{email}.</span>
          </p>
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
        <TotpCodeInput value={totpCode} onChange={setTotpCode} />
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
