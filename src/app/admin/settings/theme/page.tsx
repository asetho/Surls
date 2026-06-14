import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { getSettings } from "@/lib/settings";
import { DashboardThemePanel } from "../_components/SettingsPanels";

export const metadata: Metadata = {
  title: "Theme Editor"
};

export default async function ThemeEditorPage() {
  const admin = await requireSiteAdmin();
  if (!admin) redirect("/admin");

  const [settings, csrf] = await Promise.all([getSettings(), getCsrfToken()]);

  return (
    <main className="admin-content">
      <div className="content-header">
        <div>
          <h1>Theme Editor</h1>
          <p className="muted">Customize the signed-in dashboard palette and preview common interface states.</p>
        </div>
        <div className="content-header-actions">
          <Link className="button secondary" href="/admin/settings">
            Back to Settings
          </Link>
        </div>
      </div>

      <DashboardThemePanel csrf={csrf} mode="section" theme={settings.dashboardTheme} />
    </main>
  );
}
