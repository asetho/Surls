import { PasskeyLoginButton } from "@/components/PasskeyLoginButton";
import { SurlsLogo } from "@/components/SurlsLogo";
import { ExternalLoginButtons } from "@/components/ExternalLoginButtons";
import { TurnstileGate } from "@/components/TurnstileGate";
import { TurnstilePreviewGate } from "@/components/TurnstilePreviewGate";
import { turnstileSiteKey } from "@/lib/turnstile";
import Link from "next/link";

export function PasswordLoginForm({
  csrf,
  email,
  embedded = false,
  error,
  nextPath,
  siteName,
  localLoginEnabled,
  passwordResetEnabled = false,
  preview = false
}: {
  csrf: string;
  email?: string;
  embedded?: boolean;
  error?: string;
  nextPath: string;
  siteName: string;
  localLoginEnabled: boolean;
  passwordResetEnabled?: boolean;
  preview?: boolean;
}) {
  const title = `${siteName} login`;
  const tagline = "Sign in to manage private links, redirects, and click statistics.";
  const siteKey = preview ? undefined : turnstileSiteKey();
  const Form = preview ? "div" : "form";
  const localLoginControls = (
    <>
      <label data-surls-auth-field>
        Email
        <input name={preview ? undefined : "email"} type="email" autoComplete={preview ? "off" : "username webauthn"} readOnly={preview} required defaultValue={email ?? ""} data-surls-auth-input />
      </label>
      <label data-surls-auth-field>
        Password
        <input name={preview ? undefined : "password"} type="password" autoComplete={preview ? "off" : "current-password"} readOnly={preview} required minLength={12} data-surls-auth-input />
      </label>
      <button type={preview ? "button" : "submit"} aria-disabled={preview || undefined} data-surls-auth-submit>Log in</button>
      <div className="login-divider" data-surls-auth-divider><span>or</span></div>
      <PasskeyLoginButton nextPath={nextPath} preview={preview} />
    </>
  );

  return (
    <Form
      className={`${embedded ? "surls-auth-form-embedded" : "surface login-card"} surls-auth-form form-stack`}
      action={preview ? undefined : "/api/auth/login"}
      method={preview ? undefined : "post"}
      data-surls-auth-form
    >
      {!embedded ? (
        <div data-surls-auth-intro>
          {siteName === "Surls" ? <Link className="login-brand" href="/" aria-label="Surls home"><SurlsLogo /></Link> : null}
          <h1>{title}</h1>
          <p className="muted">{tagline}</p>
        </div>
      ) : null}
      {error ? <div className="alert">{error}</div> : null}
      {localLoginEnabled ? (
        <>
          {!preview ? <input type="hidden" name="csrf" value={csrf} /> : null}
          {!preview ? <input type="hidden" name="next" value={nextPath} /> : null}
          {preview ? <TurnstilePreviewGate>{localLoginControls}</TurnstilePreviewGate> : <TurnstileGate siteKey={siteKey}>{localLoginControls}</TurnstileGate>}
          {passwordResetEnabled && !preview ? <Link href="/forgot-password">Forgot password?</Link> : null}
        </>
      ) : null}
      <ExternalLoginButtons nextPath={nextPath} required={!localLoginEnabled} preview={preview} />
    </Form>
  );
}
