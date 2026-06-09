import type { Metadata } from "next";
import { PublicHeader } from "../layout";
import { getSiteName } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Cookie Notice"
};

export default async function CookiesPage() {
  const siteName = await getSiteName();

  return (
    <>
      <PublicHeader />
      <main className="section">
        <div className="container">
          <div className="surface" style={{ padding: "1.25rem" }}>
            <h1>{siteName} cookie notice</h1>
            <p>{siteName} uses essential cookies for admin login sessions, CSRF protection, and cookie consent storage.</p>
            <h2>Essential cookies</h2>
            <ul>
              <li>
                <strong>surls_session:</strong> HttpOnly secure admin session cookie.
              </li>
              <li>
                <strong>surls_csrf:</strong> HttpOnly CSRF token cookie for admin form protection.
              </li>
              <li>
                <strong>surls_cookie_consent:</strong> Stores your consent choice.
              </li>
              <li>
                <strong>surls-theme:</strong> Stores your Light, Dark, or Auto display preference.
              </li>
            </ul>
            <h2>Analytics cookies</h2>
            <p>
              {siteName} does not require third-party analytics cookies. Non-essential analytics should only run after the
              banner choice allows analytics.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
