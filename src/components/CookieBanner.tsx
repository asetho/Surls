"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Consent = "essential" | "analytics";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setVisible(!localStorage.getItem("surls-cookie-consent"));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  function save(choice: Consent) {
    const payload = JSON.stringify({
      essential: true,
      analytics: choice === "analytics",
      savedAt: new Date().toISOString()
    });
    localStorage.setItem("surls-cookie-consent", payload);
    document.cookie = `surls_cookie_consent=${encodeURIComponent(payload)}; path=/; max-age=31536000; samesite=lax`;
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside className="cookie-banner" aria-label="Cookie notice">
      <div>
        <strong>Surls uses essential cookies for secure admin sessions.</strong>
        <p className="muted small">
          Privacy-respecting analytics only run after consent. Short-link click statistics are collected as described in
          the cookie notice.
        </p>
      </div>
      <div className="row-actions">
        <button type="button" onClick={() => save("essential")}>
          Essential only
        </button>
        <button type="button" className="secondary" onClick={() => save("analytics")}>
          Allow analytics
        </button>
        <Link className="button secondary" href="/cookies">
          Cookie notice
        </Link>
      </div>
    </aside>
  );
}
