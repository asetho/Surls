import type { Metadata } from "next";
import { PublicHeader } from "../layout";

export const metadata: Metadata = {
  title: "Privacy"
};

export default function PrivacyPage() {
  return (
    <>
      <PublicHeader />
      <main className="section">
        <div className="container">
          <div className="surface" style={{ padding: "1.25rem" }}>
            <h1>Surls privacy notice</h1>
            <p>
              Surls is designed for a personal, self-hosted short URL site. It keeps analytics minimal and avoids raw IP
              address storage.
            </p>
            <h2>What short-link clicks collect</h2>
            <ul>
              <li>Click timestamp.</li>
              <li>Referrer when a browser provides one.</li>
              <li>User-agent-derived browser and device category.</li>
              <li>Approximate country or region only if you later enable a geolocation integration.</li>
              <li>Salted hashes for IP-derived values and unique-ish visitor counting.</li>
            </ul>
            <h2>Admin clicks</h2>
            <p>
              Authenticated admin redirects are not recorded by default. The admin settings page includes a Track admin
              clicks switch for deliberate testing.
            </p>
            <h2>Raw IP addresses</h2>
            <p>Surls does not store raw IP addresses in click events or audit logs.</p>
          </div>
        </div>
      </main>
    </>
  );
}
