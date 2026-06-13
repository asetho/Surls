import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revokeTokenAction } from "./actions";
import { BookmarkletLink } from "@/components/BookmarkletLink";
import { ApiTokenForm, ImportCsvForm, LinkCheckerForm, UtmBuilder } from "@/components/ToolsForms";
import { ConfirmButton } from "@/components/ConfirmButton";
import { APP_VERSION } from "@/lib/app-version";
import { requireAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { appBaseUrl, env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Tools"
};

export default async function ToolsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin");
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
  const bookmarklet = `javascript:(()=>{const u=encodeURIComponent(location.href);const t=encodeURIComponent(document.title);const target='${appBaseUrl()}/bookmarklet?url='+u+'&title='+t;const w=window.open(target,'surls_create','popup=yes,width=620,height=720,resizable=yes,scrollbars=yes');if(w){try{w.opener=null}catch{}w.focus()}else{location.href=target}})()`;

  return (
    <main className="admin-content">
      <div className="content-header">
        <div>
          <h1>{settings.siteName} tools</h1>
          <p className="muted">Bookmarklet, API tokens, import/export, link checks, UTM builder, cleanup, and system info.</p>
        </div>
      </div>

      <section className="grid-3">
        <div className="surface" style={{ padding: "1rem" }}>
          <h2>Bookmarklet</h2>
          <p className="muted small">Create a short URL from the current page when you are logged in.</p>
          <BookmarkletLink bookmarklet={bookmarklet} label={`Shorten with ${settings.siteName}`} />
          <code className="bookmarklet-code">{bookmarklet}</code>
        </div>
        <div className="surface" style={{ padding: "1rem" }}>
          <h2>Exports</h2>
          <div className="row-actions">
            <Link className="button secondary" href="/api/links/export?format=csv">Links CSV</Link>
            <Link className="button secondary" href="/api/links/export?format=json">Links JSON</Link>
          </div>
          <p className="muted small">Stats CSV is available from each link details page.</p>
        </div>
        <div className="surface" style={{ padding: "1rem" }}>
          <h2>Cleanup</h2>
          <p>Disabled links: {disabled}</p>
          <p>Expired links: {expired}</p>
          <p>Zero-click links: {zeroClicks}</p>
          <p>Duplicate destinations: {duplicates.length}</p>
        </div>
      </section>

      <section className="grid-3">
        <div className="surface" style={{ padding: "1rem" }}>
          <h2>API token</h2>
          <ApiTokenForm csrf={csrf} siteName={settings.siteName} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Prefix</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr key={token.id}>
                    <td>{token.name}</td>
                    <td>{token.tokenPrefix}</td>
                    <td>{token.revokedAt ? "Revoked" : "Active"}</td>
                    <td>
                      {!token.revokedAt ? (
                        <form action={revokeTokenAction}>
                          <input type="hidden" name="csrf" value={csrf} />
                          <input type="hidden" name="id" value={token.id} />
                          <ConfirmButton className="danger icon-button" type="submit" message="Revoke this API token?">
                            Revoke
                          </ConfirmButton>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="surface" style={{ padding: "1rem" }}>
          <h2>Bulk import</h2>
          <ImportCsvForm csrf={csrf} />
        </div>
        <div className="surface" style={{ padding: "1rem" }}>
          <h2>Link checker</h2>
          <LinkCheckerForm csrf={csrf} />
        </div>
      </section>

      <section className="grid-3">
        <div className="surface" style={{ padding: "1rem" }}>
          <h2>UTM builder</h2>
          <UtmBuilder />
        </div>
        <div className="surface" style={{ padding: "1rem" }}>
          <h2>API docs</h2>
          <p className="muted small">Create a short URL with a bearer token:</p>
          <pre style={{ overflowX: "auto" }}>{`curl -X POST ${appBaseUrl()}/api/links \\
  -H "Authorization: Bearer surls_..." \\
  -H "Content-Type: application/json" \\
  -d '{"destinationUrl":"https://example.com","code":"example"}'`}</pre>
        </div>
        <div className="surface" style={{ padding: "1rem" }}>
          <h2>System info</h2>
          <dl>
            <dt>App version</dt>
            <dd>{APP_VERSION}</dd>
            <dt>Environment</dt>
            <dd>{env.NODE_ENV}</dd>
            <dt>Base URL</dt>
            <dd>{appBaseUrl()}</dd>
            <dt>Track admin clicks</dt>
            <dd>{settings.trackAdminClicks ? "Enabled" : "Disabled"}</dd>
            <dt>Private destinations</dt>
            <dd>{env.ALLOW_PRIVATE_DESTINATIONS ? "Allowed by config" : "Blocked by default"}</dd>
          </dl>
        </div>
      </section>
    </main>
  );
}
