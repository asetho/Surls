import { BarChart3, LockKeyhole, QrCode, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PublicHeader } from "./layout";

export default function HomePage() {
  return (
    <>
      <PublicHeader />
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <h1>Surls</h1>
              <p>
                Surls is a personal short URL system for managing private links, redirects, and click statistics.
              </p>
              <div className="row-actions">
                <Link className="button" href="/login">
                  Open admin dashboard
                </Link>
                <Link className="button secondary" href="/privacy">
                  Read privacy notice
                </Link>
              </div>
            </div>
            <div className="hero-panel" aria-label="Surls dashboard preview">
              <div className="hero-panel-header">
                <strong>Recent links</strong>
                <span className="badge">Private admin</span>
              </div>
              <div className="fake-table">
                {[
                  ["newsletter", "42 clicks", "active"],
                  ["docs", "18 clicks", "active"],
                  ["portfolio", "0 clicks", "paused"]
                ].map(([name, clicks, status]) => (
                  <div className="fake-row" key={name}>
                    <strong>/{name}</strong>
                    <span className="muted">{clicks}</span>
                    <span>
                      <span className="status-dot" /> {status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="section">
          <div className="container grid-3">
            <div className="metric">
              <ShieldCheck aria-hidden />
              <h2>Safe destinations</h2>
              <p className="muted">Surls blocks unsafe protocols, localhost, private networks, and internal services by default.</p>
            </div>
            <div className="metric">
              <LockKeyhole aria-hidden />
              <h2>Private admin</h2>
              <p className="muted">No public registration. Admin access uses secure sessions, password login, 2FA, and backup codes.</p>
            </div>
            <div className="metric">
              <BarChart3 aria-hidden />
              <h2>Clean statistics</h2>
              <p className="muted">Admin testing clicks are excluded unless you explicitly enable admin click tracking.</p>
            </div>
            <div className="metric">
              <QrCode aria-hidden />
              <h2>Useful tools</h2>
              <p className="muted">Copy, share, QR codes, CSV export, imports, UTM building, API tokens, and link checks are built in.</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
