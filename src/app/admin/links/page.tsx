import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, RotateCcw } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyShortUrlButton, ShareButton } from "@/components/CopyShareButtons";
import { DeleteLinkModal } from "@/components/DeleteLinkModal";
import { EditLinkModal } from "@/components/EditLinkModal";
import { QrCodeModal } from "@/components/QrCodeModal";
import { isAdminUser, requireAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { appBaseUrl } from "@/lib/env";
import {
  DEFAULT_LINK_PAGE_SIZE,
  type LinkListSort,
  normalizeLinkListPage,
  normalizeLinkListPageSize,
  normalizeLinkListSort,
  normalizeLinkListTag,
  normalizeLinkListView,
  shortLinkListOrderBy,
  shortLinkListWhere
} from "@/lib/link-lifecycle";
import { shortUrl } from "@/lib/links";
import { prisma } from "@/lib/prisma";
import { getSiteName } from "@/lib/settings";
import { restoreLinkAction } from "./actions";

export const metadata: Metadata = {
  title: "Links"
};

type SearchParams = Promise<{ page?: string; pageSize?: string; q?: string; sort?: string; tag?: string; view?: string }>;

function nextSortFor(column: "clicks" | "status" | "url", sort: LinkListSort) {
  if (column === "url") return sort === "url_asc" ? "url_desc" : "url_asc";
  if (column === "clicks") return sort === "clicks_desc" ? "clicks_asc" : "clicks_desc";
  return sort === "status_desc" ? "status_asc" : "status_desc";
}

function ariaSortFor(column: "clicks" | "status" | "url", sort: LinkListSort) {
  if (column === "url" && sort === "url_asc") return "ascending" as const;
  if (column === "url" && sort === "url_desc") return "descending" as const;
  if (column === "clicks" && sort === "clicks_asc") return "ascending" as const;
  if (column === "clicks" && sort === "clicks_desc") return "descending" as const;
  if (column === "status" && sort === "status_asc") return "ascending" as const;
  if (column === "status" && sort === "status_desc") return "descending" as const;
  return "none" as const;
}

function sortBadge(column: "clicks" | "status" | "url", sort: LinkListSort) {
  if (column === "url" && sort === "url_asc") return "A-Z";
  if (column === "url" && sort === "url_desc") return "Z-A";
  if (column === "clicks" && sort === "clicks_asc") return "Low";
  if (column === "clicks" && sort === "clicks_desc") return "High";
  if (column === "status" && sort === "status_asc") return "Disabled";
  if (column === "status" && sort === "status_desc") return "Active";
  return null;
}

export default async function LinksPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = params.q?.trim();
  const view = normalizeLinkListView(params.view);
  const sort = normalizeLinkListSort(params.sort);
  const tag = normalizeLinkListTag(params.tag);
  const requestedPage = normalizeLinkListPage(params.page);
  const pageSize = normalizeLinkListPageSize(params.pageSize);
  const csrf = getCsrfToken();
  const listHref = (overrides: Partial<{
    page: number;
    pageSize: number;
    q: string | undefined;
    sort: LinkListSort;
    tag: string | undefined;
    view: "active" | "archived";
  }> = {}) => {
    const nextView = Object.hasOwn(overrides, "view") ? overrides.view : view;
    const nextQ = Object.hasOwn(overrides, "q") ? overrides.q : q;
    const nextSort = Object.hasOwn(overrides, "sort") ? overrides.sort : sort;
    const nextTag = Object.hasOwn(overrides, "tag") ? overrides.tag : tag;
    const nextPage = Object.hasOwn(overrides, "page") ? overrides.page : requestedPage;
    const nextPageSize = Object.hasOwn(overrides, "pageSize") ? overrides.pageSize : pageSize;
    const urlParams = new URLSearchParams();
    if (nextView === "archived") urlParams.set("view", "archived");
    if (nextQ) urlParams.set("q", nextQ);
    if (nextTag) urlParams.set("tag", nextTag);
    if (nextSort && nextSort !== "newest") urlParams.set("sort", nextSort);
    if (nextPage && nextPage > 1) urlParams.set("page", String(nextPage));
    if (nextPageSize && nextPageSize !== DEFAULT_LINK_PAGE_SIZE) {
      urlParams.set("pageSize", String(nextPageSize));
    }
    const query = urlParams.toString();
    return query ? `/admin/links?${query}` : "/admin/links";
  };
  const viewHref = (nextView: "active" | "archived") => {
    return listHref({ page: 1, view: nextView });
  };
  const where = shortLinkListWhere(view, q, tag);
  const [totalLinks, siteName, currentUser, activeTag] = await Promise.all([
    prisma.shortLink.count({ where }),
    getSiteName(),
    requireAdmin(),
    tag ? prisma.tag.findUnique({ where: { slug: tag }, select: { name: true, slug: true } }) : Promise.resolve(null)
  ]);
  const totalPages = Math.max(1, Math.ceil(totalLinks / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const [links] = await Promise.all([
    prisma.shortLink.findMany({
      where,
      orderBy: shortLinkListOrderBy(sort),
      include: { tags: { include: { tag: true } } },
      skip: (currentPage - 1) * pageSize,
      take: pageSize
    })
  ]);
  const baseUrl = appBaseUrl();
  const canDeleteLinks = isAdminUser(currentUser);
  const firstRow = totalLinks === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastRow = Math.min(totalLinks, currentPage * pageSize);
  const tagLabel = activeTag?.name ?? tag;
  const sortHref = (column: "clicks" | "status" | "url") => listHref({ page: 1, sort: nextSortFor(column, sort) });
  const sortableHeader = (column: "clicks" | "status" | "url", label: string) => {
    const badge = sortBadge(column, sort);
    return (
      <Link className="sort-link" href={sortHref(column)}>
        <span>{label}</span>
        {badge ? <span className="sort-badge">{badge}</span> : <span className="sort-badge muted">Sort</span>}
      </Link>
    );
  };

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
          <div>
            <h2>{view === "archived" ? "Archived links" : "Active links"}</h2>
            <p className="muted small">
              Showing {firstRow}-{lastRow} of {totalLinks} {totalLinks === 1 ? "link" : "links"}.
            </p>
          </div>
          <form className="row-actions link-filter-form" key={`${view}-${q ?? ""}-${tag ?? ""}-${sort}-${pageSize}`}>
            {view === "archived" ? <input type="hidden" name="view" value="archived" /> : null}
            {tag ? <input type="hidden" name="tag" value={tag} /> : null}
            <input name="q" placeholder="Search links or tags" defaultValue={q ?? ""} />
            <select name="sort" defaultValue={sort} aria-label="Sort links">
              <option value="newest">Newest</option>
              <option value="url_asc">Short URL A-Z</option>
              <option value="url_desc">Short URL Z-A</option>
              <option value="clicks_desc">Most clicks</option>
              <option value="clicks_asc">Fewest clicks</option>
              <option value="status_desc">Active first</option>
              <option value="status_asc">Disabled first</option>
            </select>
            <label className="inline-field">
              Rows
              <input
                inputMode="numeric"
                min={1}
                name="pageSize"
                type="number"
                defaultValue={pageSize}
                aria-label="Rows per page"
              />
            </label>
            <button type="submit" className="secondary">Filter</button>
          </form>
        </div>
        {tag ? (
          <div className="active-filter-row">
            <span className="badge">Tag: {tagLabel}</span>
            <Link className="button secondary compact-button" href={listHref({ page: 1, tag: undefined })}>
              Clear tag
            </Link>
          </div>
        ) : null}
        <div className="table-wrap">
          <table className="links-table">
            <thead>
              <tr>
                <th aria-sort={ariaSortFor("url", sort)}>{sortableHeader("url", "Short URL")}</th>
                <th>Destination</th>
                <th aria-sort={ariaSortFor("status", sort)}>{sortableHeader("status", "Status")}</th>
                <th aria-sort={ariaSortFor("clicks", sort)}>{sortableHeader("clicks", "Clicks")}</th>
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
                          <a className="short-url-pill" href={`/admin/links/${link.id}`}>{link.code}</a>
                          {view === "active" ? (
                            <QrCodeModal baseUrl={baseUrl} code={link.code} compact shortUrl={url} />
                          ) : null}
                        </div>
                        <div className="row-actions small">
                          {link.tags.map(({ tag }) => (
                            <Link
                              className="badge tag-link"
                              href={listHref({ page: 1, tag: tag.slug })}
                              key={tag.id}
                              title={`Show links tagged ${tag.name}`}
                            >
                              {tag.name}
                            </Link>
                          ))}
                        </div>
                      </td>
                      <td className="small">
                        <div className="muted small link-destination-title">{link.title || "Untitled"}</div>
                        <a href={link.destinationUrl} target="_blank" rel="noreferrer">
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
                            {canDeleteLinks ? (
                              <DeleteLinkModal
                                csrf={csrf}
                                id={link.id}
                                code={link.code}
                                shortUrl={url}
                                returnTo={listHref({})}
                              />
                            ) : null}
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
        <nav className="pagination" aria-label="Links pagination">
          <Link
            aria-disabled={currentPage <= 1}
            className="button secondary"
            href={currentPage <= 1 ? listHref({ page: 1 }) : listHref({ page: currentPage - 1 })}
          >
            Previous
          </Link>
          <span className="muted small">Page {currentPage} of {totalPages}</span>
          <Link
            aria-disabled={currentPage >= totalPages}
            className="button secondary"
            href={currentPage >= totalPages ? listHref({ page: totalPages }) : listHref({ page: currentPage + 1 })}
          >
            Next
          </Link>
        </nav>
      </section>
    </main>
  );
}
