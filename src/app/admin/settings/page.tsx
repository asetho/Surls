import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardThemeEditor } from "@/components/DashboardThemeEditor";
import { FaviconManifestEditor } from "@/components/FaviconManifestEditor";
import { requireSiteAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { filesystemCustomPageLocation, pageFromFilesystem } from "@/lib/custom-pages";
import { isDefaultDashboardTheme, type DashboardTheme } from "@/lib/dashboard-theme";
import { COMMON_DISPLAY_TIME_ZONES } from "@/lib/dates";
import { appBaseUrl } from "@/lib/env";
import {
  FAVICON_ASSETS,
  FAVICON_HTML_SNIPPET,
  FAVICON_MANIFEST_PATH,
  FAVICON_UPLOAD_ASSETS,
  getFaviconManifestNames,
  type FaviconAssetKey,
  type StoredFaviconAsset,
  type StoredFavicons
} from "@/lib/favicons";
import { getSettings } from "@/lib/settings";
import { publicWebrootFile, publicWebrootLocation, type PublicWebrootFile } from "@/lib/webroot";
import {
  resetDashboardThemeAction,
  resetFaviconsAction,
  updateFaviconManifestAction,
  updateDashboardThemeAction,
  updateSettingsAction
} from "./actions";

export const metadata: Metadata = {
  title: "Settings"
};

type CustomPageStatus = {
  active: boolean;
  detail?: string;
  label: string;
  source: string;
};

type SettingsSearchParams = Promise<{
  settingsError?: string;
  settingsSection?: string;
  settingsSuccess?: string;
}>;

type SettingsFeedback = {
  message: string;
  type: "error" | "success";
};

function fileSizeLabel(size: number) {
  return `${Math.max(1, Math.ceil(size / 1024))} KB`;
}

function faviconPreviewUrl(url: string, uploaded?: StoredFaviconAsset | null, fallback?: PublicWebrootFile | null) {
  if (!uploaded && !fallback) return null;
  const version = uploaded?.updatedAt ?? (fallback ? `${fallback.size}` : "");
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
}

function FaviconStatusPreview({
  label,
  manifestIconSrcs,
  src
}: {
  label: string;
  manifestIconSrcs?: string[];
  src?: string | null;
}) {
  if (manifestIconSrcs?.length) {
    return (
      <span className="favicon-status-preview favicon-status-preview-manifest" role="img" aria-label={`${label} preview`}>
        {manifestIconSrcs.map((iconSrc) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={iconSrc} src={iconSrc} alt="" loading="lazy" aria-hidden />
        ))}
      </span>
    );
  }

  if (src) {
    return (
      <span className="favicon-status-preview" role="img" aria-label={`${label} preview`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" loading="lazy" aria-hidden />
      </span>
    );
  }

  return (
    <span className="favicon-status-preview favicon-status-preview-empty" role="img" aria-label={`${label} preview unavailable`}>
      <span aria-hidden>--</span>
    </span>
  );
}

function CustomPageStatusList({ activeCount, pages }: { activeCount: number; pages: CustomPageStatus[] }) {
  return (
    <>
      <div className="settings-card-header">
        <h2>Custom pages</h2>
        <span className={activeCount > 0 ? "status-pill status-pill-active" : "status-pill"}>
          {activeCount > 0 ? `${activeCount} active` : "None active"}
        </span>
      </div>
      <p className="muted">
        Public pages load from <code>{publicWebrootLocation()}</code>. App-owned paths such as <code>/admin</code>,{" "}
        <code>/api</code>, <code>/_next</code>, and <code>/health</code> remain reserved.
      </p>
      <dl className="settings-status-list">
        {pages.map((page) => (
          <div key={page.label}>
            <dt>
              <span>{page.label}</span>
              <span className={page.active ? "status-pill status-pill-active" : "status-pill"}>
                {page.active ? "Active" : "Default"}
              </span>
            </dt>
            <dd>
              <span>{page.source}</span>
              {page.detail ? <span className="muted small">{page.detail}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function FaviconsPanel({
  csrf,
  feedback,
  favicons,
  siteName,
  webrootFiles
}: {
  csrf: string;
  feedback?: SettingsFeedback | null;
  favicons: StoredFavicons | null;
  siteName: string;
  webrootFiles: Partial<Record<FaviconAssetKey | "siteManifest", PublicWebrootFile | null>>;
}) {
  const manifestNames = getFaviconManifestNames(favicons, siteName);
  const activeCount = FAVICON_ASSETS.filter((asset) => {
    if (asset.key === "siteManifest") return Boolean(favicons || webrootFiles.siteManifest);
    return Boolean(favicons?.assets[asset.key] || webrootFiles[asset.key]);
  }).length;
  const manifestStatus = favicons ? "Generated" : webrootFiles.siteManifest ? "Webroot" : "Missing";
  const manifestFormId = favicons ? "favicon-manifest-form" : "favicon-upload-form";
  const manifestIconSrcs = [
    faviconPreviewUrl("/icon-192.png", favicons?.assets.icon192, webrootFiles.icon192),
    faviconPreviewUrl("/icon-512.png", favicons?.assets.icon512, webrootFiles.icon512)
  ].filter(Boolean) as string[];

  return (
    <details className="surface surface-panel settings-collapse" open={Boolean(feedback) || undefined}>
      <summary className="settings-card-header">
        <h2>Favicons</h2>
        <span className={activeCount > 0 ? "status-pill status-pill-active" : "status-pill"}>
          {activeCount > 0 ? `${activeCount} hosted` : "None hosted"}
        </span>
      </summary>
      <div className="settings-collapse-body">
        <p className="muted">
          Choose only the favicon files you want to add or replace. Existing uploaded files stay active when their fields
          are left empty. Surls hosts these files from standard root URLs so app pages and custom pages can share the same
          browser icons. The web app manifest is generated from the app names below.
        </p>
        {feedback ? (
          <div className={feedback.type === "success" ? "success" : "alert"}>{feedback.message}</div>
        ) : null}

        <dl className="settings-status-list favicon-status-list">
          {FAVICON_ASSETS.map((asset) => {
            if (asset.key === "siteManifest") {
              return (
                <div key={asset.key}>
                  <dt>
                    <span>{asset.label}</span>
                    <span className={manifestStatus === "Missing" ? "status-pill" : "status-pill status-pill-active"}>
                      {manifestStatus}
                    </span>
                  </dt>
                  <dd>
                    <FaviconStatusPreview label={asset.label} manifestIconSrcs={manifestIconSrcs} />
                    <code>{FAVICON_MANIFEST_PATH}</code>
                  </dd>
                </div>
              );
            }

            const uploaded = favicons?.assets[asset.key];
            const fallback = webrootFiles[asset.key];
            const status = uploaded ? "Uploaded" : fallback ? "Webroot" : "Missing";
            const previewSrc = faviconPreviewUrl(asset.url, uploaded, fallback);
            const detail = uploaded
              ? `${uploaded.fileName} (${fileSizeLabel(uploaded.size)})`
              : fallback
                  ? `Fallback from ${fallback.filePath} (${fileSizeLabel(fallback.size)})`
                  : null;

            return (
              <div key={asset.key}>
                <dt>
                  <span>{asset.label}</span>
                  <span className={status === "Missing" ? "status-pill" : "status-pill status-pill-active"}>{status}</span>
                </dt>
                <dd>
                  <FaviconStatusPreview label={asset.label} src={previewSrc} />
                  <code>{asset.url}</code>
                  {detail ? <span className="muted small">{detail}</span> : null}
                </dd>
              </div>
            );
          })}
        </dl>

        <details className="settings-favicon-snippet settings-collapse">
          <summary className="settings-card-header">
            <h3>Custom page snippet</h3>
            <span className="status-pill">HTML</span>
          </summary>
          <div className="settings-collapse-body">
            <label>
              Favicon tags for custom pages
              <textarea readOnly rows={4} value={FAVICON_HTML_SNIPPET} />
            </label>
          </div>
        </details>

        <details className="settings-favicon-manifest settings-collapse">
          <summary className="settings-card-header">
            <h3>Web app names</h3>
            <span className={favicons ? "status-pill status-pill-active" : "status-pill"}>
              {favicons ? "Saved" : "Used on upload"}
            </span>
          </summary>
          <div className="settings-collapse-body">
            <p className="muted">
              These values generate <code>{FAVICON_MANIFEST_PATH}</code> for Android, Apple, and installable browser
              shortcuts.
            </p>
            {favicons ? (
              <form id={manifestFormId} className="form-stack" action={updateFaviconManifestAction}>
                <input type="hidden" name="csrf" value={csrf} />
                <FaviconManifestEditor
                  defaultName={manifestNames.name}
                  defaultShortName={manifestNames.shortName}
                  formId={manifestFormId}
                  iconSrc="/icon-192.png"
                />
                <button type="submit">Save web app names</button>
              </form>
            ) : (
              <FaviconManifestEditor
                defaultName={manifestNames.name}
                defaultShortName={manifestNames.shortName}
                formId={manifestFormId}
              />
            )}
          </div>
        </details>

        <form id="favicon-upload-form" className="form-stack" action="/admin/settings/favicons" encType="multipart/form-data" method="post">
          <input type="hidden" name="csrf" value={csrf} />
          <div className="form-grid">
            {FAVICON_UPLOAD_ASSETS.map((asset) => (
              <label key={asset.key}>
                {asset.label}
                <input name={asset.fieldName} type="file" accept={asset.accept} />
                <span className="muted small">
                  {favicons?.assets[asset.key] ? "Leave empty to keep current file" : "Required for first setup"}:{" "}
                  <code>{asset.url}</code>
                </span>
              </label>
            ))}
          </div>
          <button type="submit">Save favicon files</button>
        </form>

        {favicons ? (
          <form action={resetFaviconsAction}>
            <input type="hidden" name="csrf" value={csrf} />
            <button className="secondary" type="submit">Use webroot/default favicons</button>
          </form>
        ) : null}
      </div>
    </details>
  );
}

function DashboardThemePanel({ csrf, theme }: { csrf: string; theme: DashboardTheme }) {
  const isDefault = isDefaultDashboardTheme(theme);

  return (
    <details className="surface surface-panel settings-collapse">
      <summary className="settings-card-header">
        <h2>Dashboard theme</h2>
        <span className={isDefault ? "status-pill" : "status-pill status-pill-active"}>
          {isDefault ? "Built-in" : "Custom"}
        </span>
      </summary>
      <div className="settings-collapse-body">
        <p className="muted">
          Applies to signed-in dashboard pages for every user. The toolbar Light, Dark, and Auto selector chooses which
          custom palette is active.
        </p>

        <form className="form-stack" action={updateDashboardThemeAction}>
          <input type="hidden" name="csrf" value={csrf} />
          <DashboardThemeEditor theme={theme} />
          <button type="submit">Save dashboard theme</button>
        </form>

        {!isDefault ? (
          <form action={resetDashboardThemeAction}>
            <input type="hidden" name="csrf" value={csrf} />
            <button className="secondary" type="submit">Reset dashboard theme</button>
          </form>
        ) : null}
      </div>
    </details>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: SettingsSearchParams }) {
  const admin = await requireSiteAdmin();
  if (!admin) redirect("/admin");

  const [params, settings, filesystemLoginPage, webrootIndexPage, webrootNotFoundPage, ...webrootFaviconResults] =
    await Promise.all([
      searchParams,
      getSettings(),
      pageFromFilesystem("login"),
      publicWebrootFile([]),
      publicWebrootFile(["404.html"], { allowReservedPath: true }),
      ...FAVICON_ASSETS.map((asset) => publicWebrootFile([asset.url.slice(1)]))
    ]);
  const csrf = getCsrfToken();
  const webrootFaviconFiles = Object.fromEntries(
    FAVICON_ASSETS.map((asset, index) => [asset.key, webrootFaviconResults[index]])
  ) as Partial<Record<FaviconAssetKey | "siteManifest", PublicWebrootFile | null>>;
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
  const faviconsFeedback =
    params.settingsSection === "favicons" && params.settingsError
      ? { message: params.settingsError, type: "error" as const }
      : params.settingsSection === "favicons" && params.settingsSuccess
        ? { message: params.settingsSuccess, type: "success" as const }
        : null;

  return (
    <main className="admin-content">
      <div className="content-header">
        <div>
          <h1>{settings.siteName} settings</h1>
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
          <div className="form-field">
            <label htmlFor="display-time-zone">Display timezone</label>
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
              Used for admin timestamps and historical click day buckets.{" "}
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

      <DashboardThemePanel csrf={csrf} theme={settings.dashboardTheme} />

      <FaviconsPanel
        csrf={csrf}
        favicons={settings.favicons}
        feedback={faviconsFeedback}
        siteName={settings.siteName}
        webrootFiles={webrootFaviconFiles}
      />

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
              <dt>Display timezone</dt>
              <dd>{settings.displayTimeZone}</dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}
