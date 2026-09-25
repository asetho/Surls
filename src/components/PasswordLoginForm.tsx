import { PasskeyLoginButton } from "@/components/PasskeyLoginButton";
import { ExternalLoginButtons } from "@/components/ExternalLoginButtons";
import { TurnstileGate } from "@/components/TurnstileGate";
import { turnstileSiteKey } from "@/lib/turnstile";

export function PasswordLoginForm({
  csrf,
  email,
  embedded = false,
  error,
  nextPath,
  siteName,
  localLoginEnabled
}: {
  csrf: string;
  email?: string;
  embedded?: boolean;
  error?: string;
  nextPath: string;
  siteName: string;
  localLoginEnabled: boolean;
}) {
  const title = `${siteName} login`;
  const tagline = "Sign in to manage private links, redirects, and click statistics.";
  const siteKey = turnstileSiteKey();

  return (
    <form
      className={`${embedded ? "surls-auth-form-embedded" : "surface login-card"} surls-auth-form form-stack`}
      action="/api/auth/login"
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
      {localLoginEnabled ? (
        <>
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="next" value={nextPath} />
          <TurnstileGate siteKey={siteKey}>
            <label data-surls-auth-field>
              Email
              <input name="email" type="email" autoComplete="username webauthn" required defaultValue={email ?? ""} data-surls-auth-input />
            </label>
            <label data-surls-auth-field>
              Password
              <input name="password" type="password" autoComplete="current-password" required minLength={12} data-surls-auth-input />
            </label>
            <button type="submit" data-surls-auth-submit>Log in</button>
            <div className="login-divider" data-surls-auth-divider><span>or</span></div>
            <PasskeyLoginButton nextPath={nextPath} />
          </TurnstileGate>
        </>
      ) : null}
      <ExternalLoginButtons nextPath={nextPath} required={!localLoginEnabled} />
    </form>
  );
}
