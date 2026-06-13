import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { filesystemCustomPageLocation, pageFromFilesystem } from "@/lib/custom-pages";
import { COMMON_DISPLAY_TIME_ZONES } from "@/lib/dates";
import { appBaseUrl } from "@/lib/env";
import { FAVICON_ASSETS, FAVICON_HTML_SNIPPET, type FaviconAssetKey, type StoredFavicons } from "@/lib/favicons";
import { getSettings } from "@/lib/settings";
import { publicWebrootFile, publicWebrootLocation, type PublicWebrootFile } from "@/lib/webroot";
import { resetFaviconsAction, updateSettingsAction, uploadFaviconsAction } from "./actions";

export const metadata: Metadata = {
  title: "Settings"
};

type CustomPageStatus = {
  active: boolean;
  detail?: string;
  label: string;
  source: string;
};

function fileSizeLabel(size: number) {
  return `${Math.max(1, Math.ceil(size / 1024))} KB`;
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
  favicons,
  webrootFiles
}: {
  csrf: string;
  favicons: StoredFavicons | null;
  webrootFiles: Partial<Record<FaviconAssetKey | "siteManifest", PublicWebrootFile | null>>;
}) {
  const activeCount = FAVICON_ASSETS.filter((asset) => {
    if (asset.key === "siteManifest") return Boolean(favicons?.siteManifest || favicons || webrootFiles.siteManifest);
    return Boolean(favicons?.assets[asset.key] || webrootFiles[asset.key]);
  }).length;

  return (
    <section className="surface surface-panel">
      <div className="settings-card-header">
        <h2>Favicons</h2>
        <span className={activeCount > 0 ? "status-pill status-pill-active" : "status-pill"}>
          {activeCount > 0 ? `${activeCount} hosted` : "None hosted"}
        </span>
      </div>
      <p className="muted">
        Upload the full favicon package once. Surls hosts these files from standard root URLs so app pages and custom
        pages can share the same browser icons.
      </p>

      <dl className="settings-status-list">
        {FAVICON_ASSETS.map((asset) => {
          const uploaded = asset.key === "siteManifest" ? favicons?.siteManifest : favicons?.assets[asset.key];
          const fallback = webrootFiles[asset.key];
          const generatedManifest = asset.key === "siteManifest" && favicons && !favicons.siteManifest;
          const status = uploaded ? "Uploaded" : generatedManifest ? "Generated" : fallback ? "Webroot" : "Missing";
          const detail = uploaded
            ? `${uploaded.fileName} (${fileSizeLabel(uploaded.size)})`
            : generatedManifest
              ? "Generated from the active 192px and 512px icons."
              : fallback
                ? `Fallback from ${fallback.filePath} (${fileSizeLabel(fallback.size)})`
                : asset.required
                  ? "Required for a complete favicon package."
                  : "Optional; Surls can generate this when icons are uploaded.";

          return (
            <div key={asset.key}>
              <dt>
                <span>{asset.label}</span>
                <span className={status === "Missing" ? "status-pill" : "status-pill status-pill-active"}>{status}</span>
              </dt>
              <dd>
                <code>{asset.url}</code>
                <span className="muted small">{detail}</span>
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="settings-favicon-snippet">
        <label>
          Custom page snippet
          <textarea readOnly rows={4} value={FAVICON_HTML_SNIPPET} />
        </label>
      </div>

      <form className="form-stack" action={uploadFaviconsAction} encType="multipart/form-data">
        <input type="hidden" name="csrf" value={csrf} />
        <div className="form-grid">
          {FAVICON_ASSETS.map((asset) => (
            <label key={asset.key}>
              {asset.label}
              <input name={asset.fieldName} type="file" accept={asset.accept} required={asset.required} />
              <span className="muted small">
                {asset.required ? "Required" : "Optional"}: <code>{asset.url}</code>
              </span>
            </label>
          ))}
        </div>
        <button type="submit">Upload favicon package</button>
      </form>

      {favicons ? (
        <form action={resetFaviconsAction}>
          <input type="hidden" name="csrf" value={csrf} />
          <button className="secondary" type="submit">Use webroot/default favicons</button>
        </form>
      ) : null}
    </section>
  );
}

export default async function SettingsPage() {
  const admin = await requireSiteAdmin();
  if (!admin) redirect("/admin");

  const [settings, filesystemLoginPage, webrootIndexPage, webrootNotFoundPage, ...webrootFaviconResults] =
    await Promise.all([
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
            The Light, Dark, and Auto theme selector is available in the header and admin toolbar. Each browser stores its
            own choice locally and in a first-party cookie; Auto follows the operating-system preference.
          </div>
          <button type="submit">Save settings</button>
        </form>
      </section>

      <FaviconsPanel csrf={csrf} favicons={settings.favicons} webrootFiles={webrootFaviconFiles} />

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
