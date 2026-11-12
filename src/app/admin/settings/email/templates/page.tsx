import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { adminLoginPath } from "@/lib/admin-login-path";
import { requireSiteAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { EMAIL_TEMPLATE_IDS, EMAIL_TEMPLATES, getEmailTemplate } from "@/lib/email-templates";
import { getSmtpTransportConfig } from "@/lib/smtp-settings";
import { EmailTemplateSettings } from "./EmailTemplateSettings";

export const metadata: Metadata = { title: "Email templates" };

export default async function EmailTemplatesPage() {
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminLoginPath("/admin/settings/email/templates"));
  const [saved, smtp] = await Promise.all([
    Promise.all(EMAIL_TEMPLATE_IDS.map((id) => getEmailTemplate(id))),
    getSmtpTransportConfig()
  ]);
  const templates = EMAIL_TEMPLATE_IDS.map((id, index) => ({
    id,
    label: EMAIL_TEMPLATES[id].label,
    description: EMAIL_TEMPLATES[id].description,
    required: EMAIL_TEMPLATES[id].required,
    content: saved[index].content,
    customized: saved[index].customized
  }));

  return (
    <main className="admin-content">
      <div className="content-header content-header-topbar">
        <div>
          <h1>Email templates</h1>
          <p className="muted">Customize the subject, plain text, and HTML sent by Surls.</p>
        </div>
        <div className="content-header-actions">
          <Link className="button secondary" href="/admin/settings/email">Back to Email settings</Link>
        </div>
      </div>
      <EmailTemplateSettings templates={templates} csrf={getCsrfToken()} smtpConfigured={Boolean(smtp)} />
    </main>
  );
}
