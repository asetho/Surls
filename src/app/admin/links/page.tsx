import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, RotateCcw } from "lucide-react";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyShortUrlButton, ShareButton } from "@/components/CopyShareButtons";
import { DeleteLinkModal } from "@/components/DeleteLinkModal";
import { EditLinkModal } from "@/components/EditLinkModal";
import { QrCodeModal } from "@/components/QrCodeModal";
import { adminLoginPath } from "@/lib/admin-login-path";
import { isAdminUser, requireAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { formatDateTime, resolveDisplayTimeZone } from "@/lib/dates";
import { appBaseUrl } from "@/lib/env";
import {
  DEFAULT_LINK_PAGE_SIZE,
  type LinkListSort,
  normalizeLinkListPage,
  normalizeLinkListSort,
  normalizeLinkListTag,
  normalizeLinkListView,
  resolveLinkListPageSize,
  shortLinkListOrderBy,
  shortLinkListWhere
} from "@/lib/link-lifecycle";
import { shortUrl } from "@/lib/links";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { filterLinksAction, restoreLinkAction } from "./actions";

export const metadata: Metadata = {
  title: "Links"
};

type SearchParams = Promise<{ page?: string; pageSize?: string; q?: string; sort?: string; tag?: string; view?: string }>;
type LinkSearchParams = Awaited<SearchParams>;
type SortableLinkColumn = "clicks" | "created" | "status" | "url";

function linksNextPath(params: LinkSearchParams) {
  const urlParams = new URLSearchParams();
  for (const key of ["page", "pageSize", "q", "sort", "tag", "view"] as const) {
    const value = params[key];
    if (value) urlParams.set(key, value);
  }
  const query = urlParams.toString();
  return query ? `/admin/links?${query}` : "/admin/links";
}

function nextSortFor(column: SortableLinkColumn, sort: LinkListSort) {
  if (column === "created") return sort === "created_asc" ? "newest" : "created_asc";
  if (column === "url") return sort === "url_asc" ? "url_desc" : "url_asc";
  if (column === "clicks") return sort === "clicks_desc" ? "clicks_asc" : "clicks_desc";
  return sort === "status_desc" ? "status_asc" : "status_desc";
}

function ariaSortFor(column: SortableLinkColumn, sort: LinkListSort) {
  if (column === "created" && sort === "newest") return "descending" as const;
  if (column === "created" && sort === "created_asc") return "ascending" as const;
  if (column === "url" && sort === "url_asc") return "ascending" as const;
  if (column === "url" && sort === "url_desc") return "descending" as const;
  if (column === "clicks" && sort === "clicks_asc") return "ascending" as const;
  if (column === "clicks" && sort === "clicks_desc") return "descending" as const;
  if (column === "status" && sort === "status_asc") return "ascending" as const;
  if (column === "status" && sort === "status_desc") return "descending" as const;
  return "none" as const;
}

function sortBadge(column: SortableLinkColumn, sort: LinkListSort) {
  if (column === "created" && sort === "newest") return "Newest";
  if (column === "created" && sort === "created_asc") return "Oldest";
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
  const currentUser = await requireAdmin();
  if (!currentUser) redirect(adminLoginPath(linksNextPath(params)));

  const q = params.q?.trim();
  const view = normalizeLinkListView(params.view);
  const sort = normalizeLinkListSort(params.sort);
  const tag = normalizeLinkListTag(params.tag);
  const requestedPage = normalizeLinkListPage(params.page);
  const hasPageSizeParam = Object.hasOwn(params, "pageSize");
  const pageSize = resolveLinkListPageSize(hasPageSizeParam ? params.pageSize : undefined, currentUser.linkListPageSize);
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
  const where = shortLinkListWhere(view, q, tag, isAdminUser(currentUser) ? undefined : currentUser.id);
  const [totalLinks, settings, activeTag] = await Promise.all([
    prisma.shortLink.count({ where }),
    getSettings(),
    tag ? prisma.tag.findUnique({ where: { slug: tag }, select: { name: true, slug: true } }) : Promise.resolve(null)
  ]);
  const { siteName } = settings;
  const displayTimeZone = resolveDisplayTimeZone(currentUser.displayTimeZone, settings.displayTimeZone);
  const totalPages = Math.max(1, Math.ceil(totalLinks / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const links = await prisma.shortLink.findMany({
    where,
    orderBy: shortLinkListOrderBy(sort),
    include: { tags: { include: { tag: true } } },
    skip: (currentPage - 1) * pageSize,
    take: pageSize
  });
  const baseUrl = appBaseUrl();
  const canDeleteLinks = isAdminUser(currentUser);
  const firstRow = totalLinks === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastRow = Math.min(totalLinks, currentPage * pageSize);
  const tagLabel = activeTag?.name ?? tag;
  const sortHref = (column: SortableLinkColumn) => listHref({ page: 1, sort: nextSortFor(column, sort) });
  const sortableHeader = (column: SortableLinkColumn, label: string) => {
    const badge = sortBadge(column, sort);
    return (
      <Link className="sort-link" href={sortHref(column)} aria-label={`Sort links by ${label}`}>
        <span>{label}</span>
        {badge ? <span className="sort-badge">{badge}</span> : null}
      </Link>
    );
  };

  return (
    <main className="admin-content">
      <div className="content-header content-header-topbar">
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
        <div className="content-header link-list-content-header">
          <div className="link-list-heading">
            <h2>{view === "archived" ? "Archived links" : "Active links"}</h2>
            <p className="muted small link-list-summary">
              Showing {firstRow}-{lastRow} of {totalLinks} {totalLinks === 1 ? "link" : "links"}.
            </p>
          </div>
          <form action={filterLinksAction} className="row-actions link-filter-form" key={`${view}-${q ?? ""}-${tag ?? ""}-${sort}-${pageSize}`}>
            <input type="hidden" name="csrf" value={csrf} />
            {view === "archived" ? <input type="hidden" name="view" value="archived" /> : null}
            {tag ? <input type="hidden" name="tag" value={tag} /> : null}
            <input name="q" placeholder="Search links or tags" defaultValue={q ?? ""} />
            <AutoSubmitSelect name="sort" defaultValue={sort} aria-label="Sort links">
              <option value="newest">Created newest</option>
              <option value="created_asc">Created oldest</option>
              <option value="url_asc">Short URL A-Z</option>
              <option value="url_desc">Short URL Z-A</option>
              <option value="clicks_desc">Most clicks</option>
              <option value="clicks_asc">Fewest clicks</option>
              <option value="status_desc">Active first</option>
              <option value="status_asc">Disabled first</option>
            </AutoSubmitSelect>
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
          <table className="links-table data-table data-table-dense data-table-links responsive-table">
            <colgroup>
              <col className="links-table-short-col" />
              <col className="links-table-destination-col" />
              <col className="links-table-created-col" />
              <col className="links-table-status-col" />
              <col className="links-table-clicks-col" />
              <col className="links-table-actions-col" />
            </colgroup>
            <thead>
              <tr>
                <th aria-sort={ariaSortFor("url", sort)}>{sortableHeader("url", "Short URL")}</th>
                <th>Destination</th>
                <th aria-sort={ariaSortFor("created", sort)}>{sortableHeader("created", "Created")}</th>
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
                    notes: link.notes ?? "",
                    tags: link.tags.map(({ tag }) => tag.name).join(", ")
                  };
                  return (
                    <tr key={link.id}>
                      <td data-label="Short URL">
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
                      <td className="small link-destination-cell" data-label="Destination">
                        <div className="muted small link-destination-title" title={link.title || "Untitled"}>{link.title || "Untitled"}</div>
                        <a className="link-destination-url" href={link.destinationUrl} target="_blank" rel="noreferrer" title={link.destinationUrl}>
                          <ExternalLink size={13} aria-hidden /> <span className="link-destination-url-text">{link.destinationUrl}</span>
                        </a>
                      </td>
                      <td className="small timestamp data-table-time" data-label="Created">{formatDateTime(link.createdAt, displayTimeZone)}</td>
                      <td data-label="Status">
                        <span className={link.archivedAt || !link.enabled ? "badge warning" : "badge"}>
                          {link.archivedAt ? "Archived" : link.enabled ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="data-table-numeric" data-label="Clicks">{link.clickCount}</td>
                      <td className="data-table-actions" data-label="Actions">
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
                  <td colSpan={6}>No links match this view.</td>
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
