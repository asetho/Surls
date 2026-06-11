import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import {
  LOGIN_FORM_PLACEHOLDER,
  filesystemCustomPageLocation,
  pageFromFilesystem,
  type CustomPageKind,
  type FilesystemCustomPageKind
} from "@/lib/custom-pages";
import { COMMON_DISPLAY_TIME_ZONES } from "@/lib/dates";
import { appBaseUrl } from "@/lib/env";
import type { CustomHtmlPage } from "@/lib/settings";
import { getSettings } from "@/lib/settings";
import { resetCustomPageAction, updateSettingsAction, uploadCustomPageAction } from "./actions";

export const metadata: Metadata = {
  title: "Settings"
};

function CustomPageControl({
  csrf,
  description,
  filesystemKind,
  filesystemPage,
  kind,
  page,
  title
}: {
  csrf: string;
  description: string;
  filesystemKind?: FilesystemCustomPageKind;
  filesystemPage?: CustomHtmlPage | null;
  kind: CustomPageKind;
  page: CustomHtmlPage | null;
  title: string;
}) {
  const hasFilesystemPage = Boolean(filesystemPage && filesystemKind);
  const fallbackLabel = hasFilesystemPage ? "Uploaded fallback file" : "Current file";
  const resetLabel = hasFilesystemPage ? "Remove uploaded fallback" : "Use built-in page";

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
        <input type="hidden" name="kind" value={kind} />
        <label>
          Upload HTML
          <input name="file" type="file" accept=".html,.htm,text/html" required />
        </label>
        <button type="submit">Upload {title.toLowerCase()}</button>
      </form>
      {page ? (
        <form action={resetCustomPageAction}>
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="kind" value={kind} />
          <button className="secondary" type="submit">{resetLabel}</button>
        </form>
      ) : null}
    </div>
  );
}

export default async function SettingsPage() {
  const admin = await requireSiteAdmin();
  if (!admin) redirect("/admin");

  const [settings, filesystemIndexPage, filesystemNotFoundPage] = await Promise.all([
    getSettings(),
    pageFromFilesystem("index"),
    pageFromFilesystem("notFound")
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
        <h2>Custom pages</h2>
        <p className="muted">
          Mount <code>index.html</code> and <code>404.html</code> in the custom pages directory to replace public pages from
          the filesystem, or upload small HTML files as database-backed fallbacks. Custom login pages must include one{" "}
          <code>{LOGIN_FORM_PLACEHOLDER}</code> placeholder where the secure login form should appear.
        </p>
        <div className="grid-3">
          <CustomPageControl
            csrf={csrf}
            description="Shown at the public home page."
            filesystemKind="index"
            filesystemPage={filesystemIndexPage}
            kind="index"
            page={settings.customIndexPage}
            title="Home page"
          />
          <CustomPageControl
            csrf={csrf}
            description="Shown when a short link or page is not found."
            filesystemKind="notFound"
            filesystemPage={filesystemNotFoundPage}
            kind="notFound"
            page={settings.customNotFoundPage}
            title="Not found page"
          />
          <CustomPageControl
            csrf={csrf}
            description="Wraps the app-owned admin login and 2FA forms."
            kind="login"
            page={settings.customLoginPage}
            title="Login page"
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
