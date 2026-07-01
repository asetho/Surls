import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteTokenAction, revokeTokenAction } from "./actions";
import { BookmarkletLink } from "@/components/BookmarkletLink";
import { ApiTokenForm, ImportCsvForm, LinkCheckerForm, UploadShortenForm, UtmBuilder } from "@/components/ToolsForms";
import { ToolsTabs } from "@/components/ToolsTabs";
import { ConfirmButton } from "@/components/ConfirmButton";
import { APP_BUILD_LABEL, APP_VERSION } from "@/lib/app-version";
import { adminLoginPath } from "@/lib/admin-login-path";
import { requireAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { appBaseUrl, env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { uploadMaxBytesLabel } from "@/lib/uploads";

export const metadata: Metadata = {
  title: "Tools"
};

function tokenStatus(token: { expiresAt: Date | null; revokedAt: Date | null }) {
  if (token.revokedAt) return "Revoked";
  if (token.expiresAt && token.expiresAt <= new Date()) return "Expired";
  return "Active";
}

function tokenExpirationLabel(expiresAt: Date | null) {
  return expiresAt ? expiresAt.toLocaleDateString("en-US", { dateStyle: "medium" }) : "Forever";
}

export default async function ToolsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect(adminLoginPath("/admin/tools"));
  const csrf = getCsrfToken();
  const [tokens, settings, disabled, expired, zeroClicks, duplicates] = await Promise.all([
    prisma.apiToken.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    getSettings(),
    prisma.shortLink.count({ where: { enabled: false, archivedAt: null } }),
    prisma.shortLink.count({ where: { expiresAt: { lte: new Date() }, archivedAt: null } }),
    prisma.shortLink.count({ where: { clickCount: 0, archivedAt: null } }),
    prisma.shortLink.groupBy({
      by: ["destinationUrl"],
      where: { archivedAt: null },
      _count: { destinationUrl: true },
      having: { destinationUrl: { _count: { gt: 1 } } },
      orderBy: { destinationUrl: "asc" },
      take: 10
    })
  ]);
  const bookmarklet = `javascript:(()=>{const u=encodeURIComponent(location.href);const t=encodeURIComponent(document.title);const target='${appBaseUrl()}/bookmarklet?url='+u+'&title='+t;const w=window.open(target,'surls_create','popup=yes,width=620,height=540,resizable=yes,scrollbars=yes');if(w){try{w.opener=null}catch{}w.focus()}else{location.href=target}})()`;

  return (
    <main className="admin-content">
      <div className="content-header content-header-topbar">
        <div>
          <h1>{settings.siteName} tools</h1>
          <p className="muted">Bookmarklet, file uploads, API tokens, import/export, link checks, UTM builder, cleanup, and system info.</p>
        </div>
      </div>

      <ToolsTabs
        tabs={[
          {
            id: "create",
            label: "Create",
            children: (
              <div className="tools-tab-grid">
                <section className="surface surface-panel">
                  <div className="content-header">
                    <div>
                      <h2>Upload & Shorten</h2>
                      <p className="muted small">Upload a file to this instance and create a short URL for it.</p>
                    </div>
                  </div>
                  <UploadShortenForm csrf={csrf} maxUploadLabel={uploadMaxBytesLabel()} />
                </section>
                <section className="surface tools-card">
                  <h2>Bookmarklet</h2>
                  <p className="muted small">Create a short URL from the current page when you are logged in.</p>
                  <BookmarkletLink bookmarklet={bookmarklet} label={`Shorten with ${settings.siteName}`} />
                  <code className="bookmarklet-code">{bookmarklet}</code>
                </section>
              </div>
            )
          },
          {
            id: "tokens",
            label: "Tokens",
            children: (
              <section className="surface tools-card">
                <h2>API token</h2>
                <ApiTokenForm csrf={csrf} siteName={settings.siteName} />
                <div className="table-wrap">
                  <table className="responsive-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Prefix</th>
                        <th>Scope</th>
                        <th>Expires</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokens.map((token) => (
                        <tr key={token.id}>
                          <td data-label="Name">{token.name}</td>
                          <td data-label="Prefix">{token.tokenPrefix}</td>
                          <td data-label="Scope">{token.scopes}</td>
                          <td data-label="Expires">{tokenExpirationLabel(token.expiresAt)}</td>
                          <td data-label="Status">{tokenStatus(token)}</td>
                          <td data-label="Actions">
                            <div className="row-actions small">
                              {!token.revokedAt ? (
                                <form action={revokeTokenAction}>
                                  <input type="hidden" name="csrf" value={csrf} />
                                  <input type="hidden" name="id" value={token.id} />
                                  <ConfirmButton className="danger icon-button" type="submit" message="Revoke this API token?">
                                    Revoke
                                  </ConfirmButton>
                                </form>
                              ) : null}
                              <form action={deleteTokenAction}>
                                <input type="hidden" name="csrf" value={csrf} />
                                <input type="hidden" name="id" value={token.id} />
                                <ConfirmButton className="danger-outline icon-button" type="submit" message="Delete this API token permanently?">
                                  Delete
                                </ConfirmButton>
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          },
          {
            id: "import-export",
            label: "Import/export",
            children: (
              <div className="tools-tab-grid">
                <section className="surface tools-card">
                  <h2>Bulk import</h2>
                  <ImportCsvForm csrf={csrf} />
                </section>
                <section className="surface tools-card">
                  <h2>Exports</h2>
                  <div className="row-actions">
                    <Link className="button secondary" href="/api/links/export?format=csv">Links CSV</Link>
                    <Link className="button secondary" href="/api/links/export?format=json">Links JSON</Link>
                  </div>
                  <p className="muted small">Stats CSV is available from each link details page.</p>
                </section>
              </div>
            )
          },
          {
            id: "utilities",
            label: "Utilities",
            children: (
              <div className="tools-tab-grid">
                <section className="surface tools-card">
                  <h2>Link checker</h2>
                  <LinkCheckerForm csrf={csrf} />
                </section>
                <section className="surface tools-card">
                  <h2>UTM builder</h2>
                  <UtmBuilder />
                </section>
                <section className="surface tools-card">
                  <h2>Cleanup</h2>
                  <p>Disabled links: {disabled}</p>
                  <p>Expired links: {expired}</p>
                  <p>Zero-click links: {zeroClicks}</p>
                  <p>Duplicate destinations: {duplicates.length}</p>
                </section>
              </div>
            )
          },
          {
            id: "system",
            label: "System",
            children: (
              <div className="tools-tab-grid">
                <section className="surface tools-card">
                  <h2>API docs</h2>
                  <p className="muted small">Create a short URL with a bearer token:</p>
                  <pre style={{ overflowX: "auto" }}>{`curl -X POST ${appBaseUrl()}/api/links \\
  -H "Authorization: Bearer surls_..." \\
  -H "Content-Type: application/json" \\
  -d '{"destinationUrl":"https://example.com","code":"example"}'`}</pre>
                </section>
                <section className="surface tools-card">
                  <h2>System info</h2>
                  <dl>
                    <dt>App version</dt>
                    <dd>{APP_VERSION}</dd>
                    {APP_BUILD_LABEL ? (
                      <>
                        <dt>Build</dt>
                        <dd>{APP_BUILD_LABEL}</dd>
                      </>
                    ) : null}
                    <dt>Environment</dt>
                    <dd>{env.NODE_ENV}</dd>
                    <dt>Base URL</dt>
                    <dd>{appBaseUrl()}</dd>
                    <dt>Track admin clicks</dt>
                    <dd>{settings.trackAdminClicks ? "Enabled" : "Disabled"}</dd>
                    <dt>Private destinations</dt>
                    <dd>{env.ALLOW_PRIVATE_DESTINATIONS ? "Allowed by config" : "Blocked by default"}</dd>
                  </dl>
                </section>
              </div>
            )
          }
        ]}
      />
    </main>
  );
}
