import type { Metadata } from "next";
import { PasskeyLoginButton } from "@/components/PasskeyLoginButton";
import { PublicHeader } from "../layout";
import { getCsrfToken } from "@/lib/csrf";
import { getSiteName } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Admin Login"
};

type SearchParams = Promise<{
  error?: string;
  twoFactor?: string;
  email?: string;
  next?: string;
}>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const csrf = getCsrfToken();
  const siteName = await getSiteName();
  const needsSecondFactor = params.twoFactor === "1";

  return (
    <>
      <PublicHeader />
      <main className="login-shell">
        <div className="container">
          <form className="surface login-card form-stack" action="/api/auth/login" method="post">
            <div>
              <h1>{siteName} admin login</h1>
              <p className="muted">Sign in to manage private links, redirects, and click statistics.</p>
            </div>
            {params.error ? <div className="alert">{params.error}</div> : null}
            {needsSecondFactor ? (
              <div className="success">This admin account requires a TOTP code or one unused backup code.</div>
            ) : null}
            <input type="hidden" name="csrf" value={csrf} />
            <input type="hidden" name="next" value={params.next ?? "/admin"} />
            <label>
              Email
              <input name="email" type="email" autoComplete="username" required defaultValue={params.email ?? ""} />
            </label>
            <label>
              Password
              <input name="password" type="password" autoComplete="current-password" required minLength={12} />
            </label>
            <label>
              2FA or backup code
              <input
                name="secondFactor"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={needsSecondFactor ? "Required" : "Required only after 2FA is enabled"}
              />
            </label>
            <button type="submit">Log in</button>
            <div className="login-divider">
              <span>or</span>
            </div>
            <PasskeyLoginButton nextPath={params.next ?? "/admin"} />
          </form>
        </div>
      </main>
    </>
  );
}
