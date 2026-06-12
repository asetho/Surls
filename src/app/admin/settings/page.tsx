import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { filesystemCustomPageLocation, pageFromFilesystem, type FilesystemCustomPageKind } from "@/lib/custom-pages";
import { COMMON_DISPLAY_TIME_ZONES } from "@/lib/dates";
import { appBaseUrl } from "@/lib/env";
import type { CustomHtmlPage } from "@/lib/settings";
import { getSettings } from "@/lib/settings";
import { publicWebrootFile, publicWebrootLocation, type PublicWebrootFile } from "@/lib/webroot";
import { resetCustomPageAction, updateSettingsAction, uploadCustomPageAction } from "./actions";

export const metadata: Metadata = {
  title: "Settings"
};

function WebrootFileStatus({ file, label, pathHint }: { file: PublicWebrootFile | null; label: string; pathHint: string }) {
  return (
    <div className="surface-panel">
      <h3>{label}</h3>
      <p className="muted small">
        <code>{pathHint}</code>
      </p>
      {file ? (
        <p className="small">
          Active from <code>{file.filePath}</code> ({Math.ceil(file.size / 1024)} KB)
        </p>
      ) : (
        <p className="muted small">Not present.</p>
      )}
    </div>
  );
}

function LoginTemplateControl({
  csrf,
  description,
  filesystemKind,
  filesystemPage,
  page,
  title
}: {
  csrf: string;
  description: string;
  filesystemKind?: FilesystemCustomPageKind;
  filesystemPage?: CustomHtmlPage | null;
  page: CustomHtmlPage | null;
  title: string;
}) {
  const hasFilesystemPage = Boolean(filesystemPage && filesystemKind);
  const fallbackLabel = hasFilesystemPage ? "Uploaded fallback file" : "Current file";
  const resetLabel = hasFilesystemPage ? "Remove uploaded fallback" : "Use built-in login page";

  return (
    <div className="surface-panel">
      <h3>{title}</h3>
      <p className="muted small">{description}</p>
      {hasFilesystemPage && filesystemKind ? (
        <div className="success small">
          Filesystem page active from <code>{filesystemCustomPageLocation(filesystemKind)}</code>. Uploaded HTML is kept as a
          fallback and will be used after that file is removed.
        </div>
      ) : null}
      {page ? (
        <p className="small">
          {fallbackLabel}: <strong>{page.fileName}</strong> ({Math.ceil(page.size / 1024)} KB)
        </p>
      ) : hasFilesystemPage ? (
        <p className="muted small">No uploaded fallback page is saved.</p>
      ) : (
        <p className="muted small">Using the built-in page.</p>
      )}
      <form className="form-stack" action={uploadCustomPageAction} encType="multipart/form-data">
        <input type="hidden" name="csrf" value={csrf} />
        <input type="hidden" name="kind" value="login" />
        <label>
          Upload HTML
          <input name="file" type="file" accept=".html,.htm,text/html" required />
        </label>
        <button type="submit">Upload {title.toLowerCase()}</button>
      </form>
      {page ? (
        <form action={resetCustomPageAction}>
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="kind" value="login" />
          <button className="secondary" type="submit">{resetLabel}</button>
        </form>
      ) : null}
    </div>
  );
}

export default async function SettingsPage() {
  const admin = await requireSiteAdmin();
  if (!admin) redirect("/admin");

  const [settings, filesystemLoginPage, webrootIndexPage, webrootNotFoundPage] = await Promise.all([
    getSettings(),
    pageFromFilesystem("login"),
    publicWebrootFile([]),
    publicWebrootFile(["404.html"], { allowReservedPath: true })
  ]);
  const csrf = getCsrfToken();

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

      <section className="surface" style={{ padding: "1rem" }}>
        <h2>Public webroot</h2>
        <p className="muted">
          Public files are served directly from <code>{publicWebrootLocation()}</code>. Use <code>index.html</code> for the
          public home page, <code>404.html</code> for missing public paths, and normal files or directories for assets and
          extra pages. App-owned paths such as <code>/admin</code>, <code>/api</code>, <code>/_next</code>, and{" "}
          <code>/health</code> remain reserved.
        </p>
        <div className="grid-3">
          <WebrootFileStatus file={webrootIndexPage} label="Home page" pathHint="index.html" />
          <WebrootFileStatus file={webrootNotFoundPage} label="Not found page" pathHint="404.html" />
          <LoginTemplateControl
            csrf={csrf}
            description={
              "Wraps the app-owned admin login and 2FA forms. Use {{LOGIN_FORM}} for the form slot, " +
              "and optionally {{LOGIN_TITLE}} and {{LOGIN_TAGLINE}} for app-provided text."
            }
            filesystemKind="login"
            filesystemPage={filesystemLoginPage}
            page={settings.customLoginPage}
            title="Login template"
          />
        </div>
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
          <dt>Display timezone</dt>
          <dd>{settings.displayTimeZone}</dd>
        </dl>
      </section>
    </main>
  );
}
