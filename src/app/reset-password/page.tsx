import type { Metadata } from "next";
import Link from "next/link";
import { getCsrfToken } from "@/lib/csrf";
import { passwordResetAvailable } from "@/lib/password-reset";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false } };

type SearchParams = Promise<{ token?: string | string[]; error?: string; done?: string }>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const [params, available] = await Promise.all([searchParams, passwordResetAvailable()]);
  const token = typeof params.token === "string" && /^[A-Za-z0-9_-]{43}$/.test(params.token) ? params.token : "";
  return (
    <main className="login-shell">
      <section className="surface login-card form-stack">
        <h1>Choose a new password</h1>
        {params.done === "1" ? <p className="success" role="status">Your password has been changed. All existing sessions were signed out. Sign in with your new password.</p> : null}
        {params.error === "invalid" ? <p className="alert" role="alert">This reset link is invalid, expired, or already used. Request a new link.</p> : null}
        {params.error === "password" ? <p className="alert" role="alert">Enter matching passwords of at least 12 characters.</p> : null}
        {params.error === "form" ? <p className="alert" role="alert">The form expired. Please try again.</p> : null}
        {available && token && params.done !== "1" ? (
          <form className="form-stack" method="post" action="/api/auth/password-reset/complete" encType="multipart/form-data">
            <input type="hidden" name="csrf" value={getCsrfToken()} />
            <input type="hidden" name="token" value={token} />
            <label>New password<input type="password" name="password" autoComplete="new-password" minLength={12} maxLength={4096} required /></label>
            <label>Confirm new password<input type="password" name="confirmPassword" autoComplete="new-password" minLength={12} maxLength={4096} required /></label>
            <button type="submit">Reset password</button>
          </form>
        ) : params.done !== "1" ? <p className="muted">This reset link is unavailable. Request a new one if password recovery is enabled.</p> : null}
        <Link href="/forgot-password">Request a new link</Link>
        <Link href="/admin">Back to sign in</Link>
      </section>
    </main>
  );
}
