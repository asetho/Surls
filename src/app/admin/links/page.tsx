import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyShortUrlButton, ShareButton } from "@/components/CopyShareButtons";
import { EditLinkModal } from "@/components/EditLinkModal";
import { QrCodeModal } from "@/components/QrCodeModal";
import { getCsrfToken } from "@/lib/csrf";
import { appBaseUrl } from "@/lib/env";
import { normalizeLinkListView, shortLinkListWhere } from "@/lib/link-lifecycle";
import { shortUrl } from "@/lib/links";
import { prisma } from "@/lib/prisma";
import { getSiteName } from "@/lib/settings";
import { deleteLinkAction, restoreLinkAction } from "./actions";

export const metadata: Metadata = {
  title: "Links"
};

type SearchParams = Promise<{ q?: string; sort?: string; view?: string }>;

export default async function LinksPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = params.q?.trim();
  const view = normalizeLinkListView(params.view);
  const csrf = getCsrfToken();
  const viewHref = (nextView: "active" | "archived") => {
    const urlParams = new URLSearchParams();
    if (nextView === "archived") urlParams.set("view", "archived");
    if (q) urlParams.set("q", q);
    if (params.sort) urlParams.set("sort", params.sort);
    const query = urlParams.toString();
    return query ? `/admin/links?${query}` : "/admin/links";
  };
  const [links, siteName] = await Promise.all([
    prisma.shortLink.findMany({
      where: shortLinkListWhere(view, q),
      orderBy: params.sort === "clicks" ? [{ clickCount: "desc" }] : [{ createdAt: "desc" }],
      include: { tags: { include: { tag: true } } },
      take: 100
    }),
    getSiteName()
  ]);
  const baseUrl = appBaseUrl();

  return (
    <main className="admin-content">
      <div className="content-header">
        <div>
          <h1>Link management</h1>
          <p className="muted">Create, search, copy, share, edit, disable, archive, and inspect {siteName} links.</p>
        </div>
        <div className="row-actions">
          <Link className={view === "active" ? "button" : "button secondary"} href={viewHref("active")}>
            Active
          </Link>
          <Link className={view === "archived" ? "button" : "button secondary"} href={viewHref("archived")}>
            Archived
          </Link>
        </div>
      </div>

      <section className="surface surface-panel">
        <div className="content-header">
          <h2>{view === "archived" ? "Archived links" : "Active links"}</h2>
          <form className="row-actions">
            {view === "archived" ? <input type="hidden" name="view" value="archived" /> : null}
            <input name="q" placeholder="Search links" defaultValue={q ?? ""} />
            <select name="sort" defaultValue={params.sort ?? "newest"}>
              <option value="newest">Newest</option>
              <option value="clicks">Most clicks</option>
            </select>
            <button type="submit" className="secondary">Filter</button>
          </form>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Short URL</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Clicks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {links.length ? (
                links.map((link) => {
                  const url = shortUrl(baseUrl, link.code);
                  const editableLink = {
                    id: link.id,
                    code: link.code,
                    destinationUrl: link.destinationUrl,
                    title: link.title ?? "",
                    expiresAt: link.expiresAt ? link.expiresAt.toISOString().slice(0, 16) : "",
                    maxClicks: link.maxClicks,
                    enabled: link.enabled,
                    description: link.description ?? "",
                    notes: link.notes ?? ""
                  };
                  return (
                    <tr key={link.id}>
                      <td>
                        <div className="link-list-short-row">
                          <a href={`/admin/links/${link.id}`}>/{link.code}</a>
                          {view === "active" ? (
                            <QrCodeModal baseUrl={baseUrl} code={link.code} compact shortUrl={url} />
                          ) : null}
                        </div>
                        <div className="muted small">{link.title || "Untitled"}</div>
                        <div className="row-actions small">
                          {link.tags.map(({ tag }) => (
                            <span className="badge" key={tag.id}>{tag.name}</span>
                          ))}
                        </div>
                      </td>
                      <td className="small">
                        <a href={link.destinationUrl} target="_blank">
                          <ExternalLink size={13} aria-hidden /> {link.destinationUrl}
                        </a>
                      </td>
                      <td>
                        <span className={link.archivedAt || !link.enabled ? "badge warning" : "badge"}>
                          {link.archivedAt ? "Archived" : link.enabled ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td>{link.clickCount}</td>
                      <td>
                        {view === "archived" ? (
                          <div className="row-actions">
                            <form action={restoreLinkAction}>
                              <input type="hidden" name="csrf" value={csrf} />
                              <input type="hidden" name="id" value={link.id} />
                              <ConfirmButton
                                className="secondary icon-button"
                                type="submit"
                                message={`Restore /${link.code}?`}
                              >
                                <RotateCcw size={16} aria-hidden />
                                Restore
                              </ConfirmButton>
                            </form>
                            <form className="row-actions" action={deleteLinkAction}>
                              <input type="hidden" name="csrf" value={csrf} />
                              <input type="hidden" name="id" value={link.id} />
                              <input
                                className="inline-confirm-input"
                                name="confirmCode"
                                placeholder={link.code}
                                aria-label={`Type ${link.code} to delete permanently`}
                                required
                              />
                              <ConfirmButton
                                className="danger icon-button"
                                type="submit"
                                message={`Permanently delete /${link.code} and its click history?`}
                              >
                                <Trash2 size={16} aria-hidden />
                                Delete
                              </ConfirmButton>
                            </form>
                          </div>
                        ) : (
                          <div className="row-actions">
                            <EditLinkModal csrf={csrf} link={editableLink} compact />
                            <ShareButton url={url} title={link.title} defaultTitle={`${siteName} short link`} compact />
                            <CopyShortUrlButton url={url} compact />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5}>No links match this view.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
