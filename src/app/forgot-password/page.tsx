import type { Metadata } from "next";
import Link from "next/link";
import { TurnstileGate } from "@/components/TurnstileGate";
import { getCsrfToken } from "@/lib/csrf";
import { passwordResetAvailable, PASSWORD_RESET_GENERIC_MESSAGE } from "@/lib/password-reset";
import { turnstileSiteKey } from "@/lib/turnstile";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false, follow: false } };

type SearchParams = Promise<{ sent?: string; error?: string }>;

export default async function ForgotPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const [params, available] = await Promise.all([searchParams, passwordResetAvailable()]);
  return (
    <main className="login-shell">
      <section className="surface login-card form-stack">
        <h1>Reset your password</h1>
        {params.sent === "1" ? <p className="success" role="status">{PASSWORD_RESET_GENERIC_MESSAGE}</p> : null}
        {params.error === "check" ? <p className="alert" role="alert">Complete the security check and try again.</p> : null}
        {params.error === "form" ? <p className="alert" role="alert">The form expired. Please try again.</p> : null}
        {available ? (
          <>
            <p className="muted">Enter your account email address. If it has a local password, we’ll send a reset link.</p>
            <form className="form-stack" method="post" action="/api/auth/password-reset/request" encType="multipart/form-data">
              <input type="hidden" name="csrf" value={getCsrfToken()} />
              <TurnstileGate siteKey={turnstileSiteKey()}>
                <label>Email<input type="email" name="email" autoComplete="email" maxLength={320} required /></label>
                <button type="submit">Send reset link</button>
              </TurnstileGate>
            </form>
          </>
        ) : <p className="muted">Email password resets are unavailable. Contact your site administrator if you need help signing in.</p>}
        <Link href="/admin">Back to sign in</Link>
      </section>
    </main>
  );
}
