import type { Metadata } from "next";
import { getCsrfToken } from "@/lib/csrf";
import { COMMON_DISPLAY_TIME_ZONES, formatDateTime } from "@/lib/dates";
import { appBaseUrl } from "@/lib/env";
import type { CustomHtmlPage } from "@/lib/settings";
import { getSettings } from "@/lib/settings";
import { resetCustomPageAction, updateSettingsAction, uploadCustomPageAction } from "./actions";

export const metadata: Metadata = {
  title: "Settings"
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function CustomPageUpload({
  csrf,
  kind,
  page,
  title,
  timeZone
}: {
  csrf: string;
  kind: "index" | "notFound";
  page: CustomHtmlPage | null;
  title: string;
  timeZone: string;
}) {
  return (
    <div className="custom-page-card">
      <div>
        <h3>{title}</h3>
        {page ? (
          <p className="muted small">
            Using {page.fileName} ({formatBytes(page.size)}), uploaded{" "}
            <span className="timestamp">{formatDateTime(new Date(page.updatedAt), timeZone)}</span>.
          </p>
        ) : (
          <p className="muted small">Using the built-in {title.toLowerCase()}.</p>
        )}
      </div>
      <form className="form-stack" action={uploadCustomPageAction} encType="multipart/form-data">
        <input type="hidden" name="csrf" value={csrf} />
        <input type="hidden" name="kind" value={kind} />
        <label>
          HTML file
          <input name="htmlFile" type="file" accept=".html,.htm,text/html" required />
          <span className="muted small">Upload a .html or .htm file up to 256 KB. Inline CSS is supported.</span>
        </label>
        <div className="row-actions">
          <button type="submit">Upload {title}</button>
          {page ? (
            <button form={`reset-${kind}-page`} className="secondary" type="submit">
              Reset
            </button>
          ) : null}
        </div>
      </form>
      {page ? (
        <form id={`reset-${kind}-page`} action={resetCustomPageAction}>
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="kind" value={kind} />
        </form>
      ) : null}
    </div>
  );
}

export default async function SettingsPage() {
  const settings = await getSettings();
  const csrf = getCsrfToken();

  return (
    <main className="admin-content">
      <div className="content-header">
        <div>
          <h1>{settings.siteName} settings</h1>
          <p className="muted">Control privacy, redirect behavior, branding, and UI defaults.</p>
        </div>
      </div>

      <section className="surface surface-panel">
        <form className="form-stack" action={updateSettingsAction}>
          <input type="hidden" name="csrf" value={csrf} />
          <label>
            Site name
            <input name="siteName" defaultValue={settings.siteName} />
          </label>
          <label>
            Display timezone
            <input name="displayTimeZone" list="display-time-zones" defaultValue={settings.displayTimeZone} />
            <datalist id="display-time-zones">
              {COMMON_DISPLAY_TIME_ZONES.map((timeZone) => (
                <option value={timeZone} key={timeZone} />
              ))}
            </datalist>
            <span className="muted small">Used for admin timestamps and historical click day buckets.</span>
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
              activity, referrer stats, browser/device stats, or unique visit counts.
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
            The Light, Dark, and Auto theme selector is available in the public header and admin sidebar. Each browser
            stores its own choice locally and in a first-party cookie; Auto follows the operating-system preference.
          </div>
          <button type="submit">Save settings</button>
        </form>
      </section>

      <section className="surface surface-panel">
        <h2>Current security-related settings</h2>
        <dl>
          <dt>Base URL</dt>
          <dd>{appBaseUrl()}</dd>
          <dt>Track admin clicks</dt>
          <dd>{settings.trackAdminClicks ? "Enabled" : "Disabled"}</dd>
          <dt>Preserve redirect query</dt>
          <dd>{settings.preserveRedirectQuery ? "Enabled" : "Disabled"}</dd>
          <dt>Display timezone</dt>
          <dd>{settings.displayTimeZone}</dd>
        </dl>
      </section>

      <section className="surface surface-panel">
        <div className="content-header">
          <div>
            <h2>Custom public pages</h2>
            <p className="muted">
              Upload custom HTML for the public index page and the not-found page. Reset either page to return to the
              built-in Surls view.
            </p>
          </div>
        </div>
        <div className="custom-page-grid">
          <CustomPageUpload
            csrf={csrf}
            kind="index"
            page={settings.customIndexPage}
            title="Index page"
            timeZone={settings.displayTimeZone}
          />
          <CustomPageUpload
            csrf={csrf}
            kind="notFound"
            page={settings.customNotFoundPage}
            title="404 page"
            timeZone={settings.displayTimeZone}
          />
        </div>
      </section>
    </main>
  );
}
