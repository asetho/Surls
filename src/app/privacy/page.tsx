import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicHeader } from "../layout";
import { hasCustomPublicPages } from "@/lib/custom-pages";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Privacy"
};

export default async function PrivacyPage() {
  const settings = await getSettings();
  if (await hasCustomPublicPages(settings)) notFound();
  const siteName = settings.siteName;

  return (
    <>
      <PublicHeader />
      <main className="section">
        <div className="container">
          <div className="surface surface-panel">
            <h1>{siteName} privacy notice</h1>
            <p>
              {siteName} is designed for a personal, self-hosted short URL site. It keeps analytics focused on short-link
              activity and admin security.
            </p>
            <h2>What short-link clicks collect</h2>
            <ul>
              <li>Click timestamp.</li>
              <li>Referrer when a browser provides one.</li>
              <li>User-agent-derived browser and device category.</li>
              <li>IP address for the recent detailed click log, retained for 30 days.</li>
              <li>Approximate country or region only if you later enable a geolocation integration.</li>
              <li>Salted hashes for IP-derived values and unique visit counting.</li>
            </ul>
            <h2>Admin clicks</h2>
            <p>
              Authenticated admin redirects are not recorded by default. The admin settings page includes a Track admin
              clicks switch for deliberate testing.
            </p>
            <h2>Raw IP addresses</h2>
            <p>
              {siteName} stores raw IP addresses with recent click events for operational troubleshooting, then clears
              them after 30 days. Longer-lived analytics use salted IP-derived hashes.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
