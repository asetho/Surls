import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { adminLoginPath } from "@/lib/admin-login-path";
import { requireSiteAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { getSettings } from "@/lib/settings";
import { FaviconsPanel, getWebrootFaviconFiles } from "../../_components/SettingsPanels";

export const metadata: Metadata = {
  title: "Favicon Editor"
};

export default async function FaviconEditorPage() {
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminLoginPath("/admin/settings/favicons/editor"));

  const [settings, csrf, webrootFaviconFiles] = await Promise.all([
    getSettings(),
    getCsrfToken(),
    getWebrootFaviconFiles()
  ]);

  return (
    <main className="admin-content">
      <div className="content-header content-header-topbar">
        <div>
          <h1>Favicon Editor</h1>
          <p className="muted">Manage browser icons, app icons, and install-screen names for Surls pages.</p>
        </div>
        <div className="content-header-actions">
          <Link className="button secondary" href="/admin/settings">
            Back to Settings
          </Link>
        </div>
      </div>

      <FaviconsPanel
        csrf={csrf}
        favicons={settings.favicons}
        mode="section"
        siteName={settings.siteName}
        webrootFiles={webrootFaviconFiles}
      />
    </main>
  );
}
