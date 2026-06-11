import { PasskeyLoginButton } from "@/components/PasskeyLoginButton";

export function PasswordLoginForm({
  csrf,
  email,
  error,
  nextPath,
  siteName
}: {
  csrf: string;
  email?: string;
  error?: string;
  nextPath: string;
  siteName: string;
}) {
  return (
    <form className="surface login-card form-stack" action="/api/auth/login" method="post">
      <div>
        <h1>{siteName} login</h1>
        <p className="muted">Sign in to manage private links, redirects, and click statistics.</p>
      </div>
      {error ? <div className="alert">{error}</div> : null}
      <input type="hidden" name="csrf" value={csrf} />
      <input type="hidden" name="next" value={nextPath} />
      <label>
        Email
        <input name="email" type="email" autoComplete="username webauthn" required defaultValue={email ?? ""} />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required minLength={12} />
      </label>
      <button type="submit">Log in</button>
      <div className="login-divider">
        <span>or</span>
      </div>
      <PasskeyLoginButton nextPath={nextPath} />
    </form>
  );
}
