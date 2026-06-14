import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { getSettings } from "@/lib/settings";
import { buildFaviconsFeedback, FaviconsPanel, getWebrootFaviconFiles } from "../../_components/SettingsPanels";

export const metadata: Metadata = {
  title: "Favicon Editor"
};

type FaviconEditorSearchParams = Promise<{
  settingsError?: string;
  settingsSection?: string;
  settingsSuccess?: string;
}>;

export default async function FaviconEditorPage({ searchParams }: { searchParams: FaviconEditorSearchParams }) {
  const admin = await requireSiteAdmin();
  if (!admin) redirect("/admin");

  const [params, settings, csrf, webrootFaviconFiles] = await Promise.all([
    searchParams,
    getSettings(),
    getCsrfToken(),
    getWebrootFaviconFiles()
  ]);
  const feedback = buildFaviconsFeedback(params);

  return (
    <main className="admin-content">
      <div className="content-header">
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
        feedback={feedback}
        mode="section"
        siteName={settings.siteName}
        webrootFiles={webrootFaviconFiles}
      />
    </main>
  );
}
