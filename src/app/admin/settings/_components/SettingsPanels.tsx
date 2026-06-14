import { DashboardThemeEditor } from "@/components/DashboardThemeEditor";
import { FaviconManifestEditor } from "@/components/FaviconManifestEditor";
import { isDefaultDashboardTheme, type DashboardTheme } from "@/lib/dashboard-theme";
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
import { publicWebrootFile, publicWebrootLocation, type PublicWebrootFile } from "@/lib/webroot";
import {
  resetDashboardThemeAction,
  resetFaviconsAction,
  updateDashboardThemeAction,
  updateFaviconManifestAction
} from "../actions";

export type CustomPageStatus = {
  active: boolean;
  detail?: string;
  label: string;
  source: string;
};

export type SettingsFeedback = {
  message: string;
  type: "error" | "success";
};

type PanelMode = "collapsed" | "section";

type WebrootFaviconFiles = Partial<Record<FaviconAssetKey | "siteManifest", PublicWebrootFile | null>>;

export function fileSizeLabel(size: number) {
  return `${Math.max(1, Math.ceil(size / 1024))} KB`;
}

export async function getWebrootFaviconFiles() {
  const webrootFaviconResults = await Promise.all(
    FAVICON_ASSETS.map((asset) => publicWebrootFile([asset.url.slice(1)]))
  );

  return Object.fromEntries(
    FAVICON_ASSETS.map((asset, index) => [asset.key, webrootFaviconResults[index]])
  ) as WebrootFaviconFiles;
}

export function buildFaviconsFeedback(params: {
  settingsError?: string;
  settingsSection?: string;
  settingsSuccess?: string;
}) {
  if (params.settingsSection !== "favicons") return null;
  if (params.settingsError) return { message: params.settingsError, type: "error" as const };
  if (params.settingsSuccess) return { message: params.settingsSuccess, type: "success" as const };
  return null;
}

export function faviconActiveCount(favicons: StoredFavicons | null, webrootFiles: WebrootFaviconFiles) {
  return FAVICON_ASSETS.filter((asset) => {
    if (asset.key === "siteManifest") return Boolean(favicons || webrootFiles.siteManifest);
    return Boolean(favicons?.assets[asset.key] || webrootFiles[asset.key]);
  }).length;
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

export function CustomPageStatusList({ activeCount, pages }: { activeCount: number; pages: CustomPageStatus[] }) {
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

export function DashboardThemePanel({
  csrf,
  mode = "collapsed",
  theme
}: {
  csrf: string;
  mode?: PanelMode;
  theme: DashboardTheme;
}) {
  const isDefault = isDefaultDashboardTheme(theme);
  const header = (
    <div className="settings-card-header">
      <h2>Dashboard theme</h2>
      <span className={isDefault ? "status-pill" : "status-pill status-pill-active"}>
        {isDefault ? "Built-in" : "Custom"}
      </span>
    </div>
  );
  const body = (
    <div className="settings-collapse-body">
      <p className="muted">
        Applies to signed-in dashboard pages for every user. The toolbar Light, Dark, and Auto selector chooses which
        custom palette is active.
      </p>

      <form id="dashboard-theme-form" className="form-stack" action={updateDashboardThemeAction}>
        <input type="hidden" name="csrf" value={csrf} />
        <DashboardThemeEditor theme={theme} />
        <div className="settings-form-actions">
          <button type="submit">Save dashboard theme</button>
          {!isDefault ? (
            <button className="secondary" type="submit" form="dashboard-theme-reset-form">
              Reset dashboard theme
            </button>
          ) : null}
        </div>
      </form>

      {!isDefault ? (
        <form id="dashboard-theme-reset-form" className="settings-hidden-form" action={resetDashboardThemeAction}>
          <input type="hidden" name="csrf" value={csrf} />
        </form>
      ) : null}
    </div>
  );

  if (mode === "section") {
    return (
      <section className="surface surface-panel settings-editor-panel">
        {header}
        {body}
      </section>
    );
  }

  return (
    <details className="surface surface-panel settings-collapse">
      <summary className="settings-card-header">
        <h2>Dashboard theme</h2>
        <span className={isDefault ? "status-pill" : "status-pill status-pill-active"}>
          {isDefault ? "Built-in" : "Custom"}
        </span>
      </summary>
      {body}
    </details>
  );
}

export function FaviconsPanel({
  csrf,
  favicons,
  feedback,
  mode = "collapsed",
  siteName,
  webrootFiles
}: {
  csrf: string;
  favicons: StoredFavicons | null;
  feedback?: SettingsFeedback | null;
  mode?: PanelMode;
  siteName: string;
  webrootFiles: WebrootFaviconFiles;
}) {
  const manifestNames = getFaviconManifestNames(favicons, siteName);
  const activeCount = faviconActiveCount(favicons, webrootFiles);
  const manifestStatus = favicons ? "Generated" : webrootFiles.siteManifest ? "Webroot" : "Missing";
  const manifestFormId = favicons ? "favicon-manifest-form" : "favicon-upload-form";
  const manifestIconSrcs = [
    faviconPreviewUrl("/icon-192.png", favicons?.assets.icon192, webrootFiles.icon192),
    faviconPreviewUrl("/icon-512.png", favicons?.assets.icon512, webrootFiles.icon512)
  ].filter(Boolean) as string[];
  const header = (
    <div className="settings-card-header">
      <h2>Favicons</h2>
      <span className={activeCount > 0 ? "status-pill status-pill-active" : "status-pill"}>
        {activeCount > 0 ? `${activeCount} hosted` : "None hosted"}
      </span>
    </div>
  );
  const body = (
    <div className="settings-collapse-body">
      <p className="muted">
        Choose only the favicon files you want to add or replace. Existing uploaded files stay active when their fields
        are left empty. Surls hosts these files from standard root URLs so app pages and custom pages can share the same
        browser icons. The web app manifest is generated from the app names below.
      </p>
      {feedback ? <div className={feedback.type === "success" ? "success" : "alert"}>{feedback.message}</div> : null}

      <dl className="settings-status-list favicon-status-list">
        {FAVICON_ASSETS.map((asset) => {
          if (asset.key === "siteManifest") {
            return (
              <div key={asset.key}>
                <dt>
                  <span>{asset.label}</span>
                </dt>
                <dd>
                  <FaviconStatusPreview label={asset.label} manifestIconSrcs={manifestIconSrcs} />
                  <code>{FAVICON_MANIFEST_PATH}</code>
                </dd>
                <span className={manifestStatus === "Missing" ? "status-pill" : "status-pill status-pill-active"}>
                  {manifestStatus}
                </span>
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
              </dt>
              <dd>
                <FaviconStatusPreview label={asset.label} src={previewSrc} />
                <code>{asset.url}</code>
                {detail ? <span className="muted small">{detail}</span> : null}
              </dd>
              <span className={status === "Missing" ? "status-pill" : "status-pill status-pill-active"}>{status}</span>
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
        <div className="settings-form-actions">
          <button type="submit">Save favicon files</button>
          {favicons ? (
            <button className="secondary" type="submit" form="favicon-reset-form">
              Use webroot/default favicons
            </button>
          ) : null}
        </div>
      </form>

      {favicons ? (
        <form id="favicon-reset-form" className="settings-hidden-form" action={resetFaviconsAction}>
          <input type="hidden" name="csrf" value={csrf} />
        </form>
      ) : null}
    </div>
  );

  if (mode === "section") {
    return (
      <section className="surface surface-panel settings-editor-panel">
        {header}
        {body}
      </section>
    );
  }

  return (
    <details className="surface surface-panel settings-collapse" open={Boolean(feedback) || undefined}>
      <summary className="settings-card-header">
        <h2>Favicons</h2>
        <span className={activeCount > 0 ? "status-pill status-pill-active" : "status-pill"}>
          {activeCount > 0 ? `${activeCount} hosted` : "None hosted"}
        </span>
      </summary>
      {body}
    </details>
  );
}
