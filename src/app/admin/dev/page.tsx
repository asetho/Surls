import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { adminLoginPath } from "@/lib/admin-login-path";
import { requireSiteAdmin } from "@/lib/auth";
import { hmservDevPreviewEnabled } from "@/lib/dev-preview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Development previews",
  robots: { index: false, follow: false }
};

export default async function DevelopmentPreviewsPage() {
  if (!hmservDevPreviewEnabled()) notFound();
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminLoginPath("/admin/dev"));

  return (
    <main className="admin-dev-preview dev-preview-index">
      <section className="surface surface-panel">
        <h1>Development previews</h1>
        <p className="muted">For the hmserv development instance only. These flows use sample values and do not sign in, send email, or change account settings.</p>
        <div className="dev-preview-links">
          <Link className="button" href="/admin/dev/login">Test login flow</Link>
          <Link className="button secondary" href="/admin/dev/profile">Test profile verification</Link>
        </div>
      </section>
    </main>
  );
}
