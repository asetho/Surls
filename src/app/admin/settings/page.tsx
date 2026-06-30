import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { adminLoginPath } from "@/lib/admin-login-path";
import { requireSiteAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { filesystemCustomPageLocation, pageFromFilesystem } from "@/lib/custom-pages";
import { isDefaultDashboardTheme } from "@/lib/dashboard-theme";
import { COMMON_DISPLAY_TIME_ZONES } from "@/lib/dates";
import { appBaseUrl } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { publicWebrootFile } from "@/lib/webroot";
import {
  CustomPageStatusList,
  faviconActiveCount,
  fileSizeLabel,
  getWebrootFaviconFiles,
  type CustomPageStatus
} from "./_components/SettingsPanels";
import { updateSettingsAction } from "./actions";

export const metadata: Metadata = {
  title: "Settings"
};

export default async function SettingsPage() {
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminLoginPath("/admin/settings"));

  const [settings, filesystemLoginPage, webrootIndexPage, webrootNotFoundPage, webrootUnavailablePage, webrootFaviconFiles] =
    await Promise.all([
      getSettings(),
      pageFromFilesystem("login"),
      publicWebrootFile([]),
      publicWebrootFile(["404.html"], { allowReservedPath: true }),
      publicWebrootFile(["unavailable.html"]),
      getWebrootFaviconFiles()
    ]);
  const csrf = getCsrfToken();
  const loginFilesystemPath = filesystemCustomPageLocation("login");
  const customPageStatuses: CustomPageStatus[] = [
    webrootIndexPage
      ? {
          active: true,
          label: "Home page",
          source: `index.html from ${webrootIndexPage.filePath}`,
          detail: fileSizeLabel(webrootIndexPage.size)
        }
      : {
          active: false,
          label: "Home page",
          source: "No index.html is active from the public webroot."
        },
    webrootNotFoundPage
      ? {
          active: true,
          label: "Not found page",
          source: `404.html from ${webrootNotFoundPage.filePath}`,
          detail: fileSizeLabel(webrootNotFoundPage.size)
        }
      : {
          active: false,
          label: "Not found page",
          source: "No 404.html is active from the public webroot."
        },
    webrootUnavailablePage
      ? {
          active: true,
          label: "URL unavailable page",
          source: `unavailable.html from ${webrootUnavailablePage.filePath}`,
          detail: fileSizeLabel(webrootUnavailablePage.size)
        }
      : {
          active: false,
          label: "URL unavailable page",
          source: "Using the built-in unavailable page for archived, disabled, expired, and click-limited links."
        },
    filesystemLoginPage
      ? {
          active: true,
          label: "Login template",
          source: `login.html from ${loginFilesystemPath}`,
          detail: settings.customLoginPage
            ? `Uploaded fallback saved: ${settings.customLoginPage.fileName} (${fileSizeLabel(settings.customLoginPage.size)})`
            : fileSizeLabel(filesystemLoginPage.size)
        }
      : settings.customLoginPage
        ? {
            active: true,
            label: "Login template",
            source: `Uploaded fallback: ${settings.customLoginPage.fileName}`,
            detail: fileSizeLabel(settings.customLoginPage.size)
          }
        : {
            active: false,
            label: "Login template",
            source: "Using the built-in admin login page."
          }
  ];
  const activeCustomPageCount = customPageStatuses.filter((page) => page.active).length;
  const isDefaultTheme = isDefaultDashboardTheme(settings.dashboardTheme);
  const hostedFaviconCount = faviconActiveCount(settings.favicons, webrootFaviconFiles);
  return (
    <main className="admin-content">
      <div className="content-header content-header-topbar">
        <div>
          <h1>{settings.siteName} settings</h1>
          <p className="muted">Control privacy, redirect behavior, branding, and UI defaults.</p>
        </div>
        <div className="content-header-actions">
          <Link id="theme-editor-button" className="button secondary" href="/admin/settings?themeEditor=open">
            Theme Editor
          </Link>
          <Link className="button secondary" href="/admin/style-reference">
            Style Reference
          </Link>
          <Link id="favicon-editor-button" className="button secondary" href="/admin/settings/favicons/editor">
            Favicon Editor
          </Link>
        </div>
      </div>

      <section className="surface" style={{ padding: "1rem" }}>
        <form className="form-stack" action={updateSettingsAction}>
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="returnTo" value="/admin/settings" />
          <label>
            Site name
            <input name="siteName" defaultValue={settings.siteName} />
          </label>
          <div className="form-field">
            <label htmlFor="display-time-zone">App-wide default timezone</label>
            <input
              id="display-time-zone"
              name="displayTimeZone"
              list="display-time-zones"
              defaultValue={settings.displayTimeZone}
            />
            <datalist id="display-time-zones">
              {COMMON_DISPLAY_TIME_ZONES.map((timeZone) => (
                <option value={timeZone} key={timeZone} />
              ))}
            </datalist>
            <span className="muted small">
              Used when a signed-in user has not chosen their own timestamp timezone.{" "}
              <a href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones" target="_blank" rel="noreferrer">
                View supported IANA time zone names
              </a>
              .
            </span>
          </div>
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
            The Light, Dark, and Auto theme selector is available in the header and admin toolbar. Each browser stores its
            own choice locally and in a first-party cookie; Auto follows the operating-system preference.
          </div>
          <button type="submit">Save settings</button>
        </form>
      </section>

      <section className="settings-editor-card-grid">
        <div className="surface surface-panel settings-editor-card">
          <div className="settings-card-header">
            <h2>Dashboard theme</h2>
            <span className={isDefaultTheme ? "status-pill" : "status-pill status-pill-active"}>
              {isDefaultTheme ? "Built-in" : "Custom"}
            </span>
          </div>
          <p className="muted">Adjust signed-in dashboard colors, light/dark palettes, and live previews.</p>
          <Link className="button secondary" href="/admin/settings?themeEditor=open">
            Open Theme Editor
          </Link>
        </div>

        <div className="surface surface-panel settings-editor-card">
          <div className="settings-card-header">
            <h2>Favicons</h2>
            <span className={hostedFaviconCount > 0 ? "status-pill status-pill-active" : "status-pill"}>
              {hostedFaviconCount > 0 ? `${hostedFaviconCount} hosted` : "None hosted"}
            </span>
          </div>
          <p className="muted">Upload browser icons, app icons, and generated install-screen names.</p>
          <Link className="button secondary" href="/admin/settings/favicons/editor">
            Open Favicon Editor
          </Link>
        </div>

      </section>

      <div className="settings-status-grid">
        <section className="surface surface-panel">
          <CustomPageStatusList activeCount={activeCustomPageCount} pages={customPageStatuses} />
        </section>

        <section className="surface surface-panel">
          <h2>Current security-related settings</h2>
          <dl className="settings-status-list">
            <div>
              <dt>Base URL</dt>
              <dd>{appBaseUrl()}</dd>
            </div>
            <div>
              <dt>Track admin clicks</dt>
              <dd>{settings.trackAdminClicks ? "Enabled" : "Disabled"}</dd>
            </div>
            <div>
              <dt>Preserve redirect query</dt>
              <dd>{settings.preserveRedirectQuery ? "Enabled" : "Disabled"}</dd>
            </div>
            <div>
              <dt>App-wide default timezone</dt>
              <dd>{settings.displayTimeZone}</dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}
