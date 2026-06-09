import type { Metadata } from "next";
import { getCsrfToken } from "@/lib/csrf";
import { appBaseUrl } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { updateSettingsAction } from "./actions";

export const metadata: Metadata = {
  title: "Settings"
};

export default async function SettingsPage() {
  const settings = await getSettings();
  const csrf = getCsrfToken();

  return (
    <main className="admin-content">
      <div className="content-header">
        <div>
          <h1>Surls settings</h1>
          <p className="muted">Control privacy, redirect behavior, branding, and UI defaults.</p>
        </div>
      </div>

      <section className="surface" style={{ padding: "1rem" }}>
        <form className="form-stack" action={updateSettingsAction}>
          <input type="hidden" name="csrf" value={csrf} />
          <label>
            Site name
            <input name="siteName" defaultValue={settings.siteName} />
          </label>
          <label>
            <span>
              <input
                name="trackAdminClicks"
                type="checkbox"
                defaultChecked={settings.trackAdminClicks}
                style={{ width: "auto", minHeight: "auto" }}
              />{" "}
              Track admin clicks
            </span>
            <span className="muted small">
              Default is off. When disabled, authenticated admin redirects do not increment totals, rankings, recent
              activity, referrer stats, browser/device stats, or unique-ish counts.
            </span>
          </label>
          <label>
            <span>
              <input
                name="preserveRedirectQuery"
                type="checkbox"
                defaultChecked={settings.preserveRedirectQuery}
                style={{ width: "auto", minHeight: "auto" }}
              />{" "}
              Preserve incoming redirect query strings
            </span>
            <span className="muted small">
              When enabled, query parameters on a short URL are appended to the destination only if that destination does
              not already define the same key.
            </span>
          </label>
          <div className="success">
            The Light, Dark, and Auto theme selector is available in the header and admin toolbar. Each browser stores its
            own choice locally and in a first-party cookie; Auto follows the operating-system preference.
          </div>
          <button type="submit">Save settings</button>
        </form>
      </section>

      <section className="surface" style={{ padding: "1rem" }}>
        <h2>Current security-related settings</h2>
        <dl>
          <dt>Base URL</dt>
          <dd>{appBaseUrl()}</dd>
          <dt>Track admin clicks</dt>
          <dd>{settings.trackAdminClicks ? "Enabled" : "Disabled"}</dd>
          <dt>Preserve redirect query</dt>
          <dd>{settings.preserveRedirectQuery ? "Enabled" : "Disabled"}</dd>
        </dl>
      </section>
    </main>
  );
}
