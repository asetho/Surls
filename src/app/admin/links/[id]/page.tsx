import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Archive, Download, ExternalLink, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyShortUrlButton, ShareButton } from "@/components/CopyShareButtons";
import { BrowserDeviceCharts, SourcesCharts } from "@/components/DistributionCharts";
import { EditLinkModal } from "@/components/EditLinkModal";
import { HistoricalClicksPanel } from "@/components/HistoricalClicksPanel";
import { LocationCharts } from "@/components/LocationCharts";
import { QrCodeModal } from "@/components/QrCodeModal";
import { StatsTabs } from "@/components/StatsTabs";
import { getCsrfToken } from "@/lib/csrf";
import { formatDateTime } from "@/lib/dates";
import { appBaseUrl } from "@/lib/env";
import {
  DEFAULT_RECENT_CLICK_PAGE_SIZE,
  MAX_RECENT_CLICK_PAGE_SIZE,
  clickStats,
  normalizeRecentClickPage,
  normalizeRecentClickPageSize
} from "@/lib/clicks";
import { shortUrl } from "@/lib/links";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { archiveLinkAction, deleteLinkAction, restoreLinkAction } from "../actions";

export const metadata: Metadata = {
  title: "Link Stats"
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ clickPage?: string; clickPageSize?: string }>;
};

function recentClicksHref(linkId: string, page: number, pageSize: number) {
  const searchParams = new URLSearchParams();
  if (page > 1) searchParams.set("clickPage", String(page));
  if (pageSize !== DEFAULT_RECENT_CLICK_PAGE_SIZE) searchParams.set("clickPageSize", String(pageSize));
  const query = searchParams.toString();
  return `/admin/links/${linkId}${query ? `?${query}` : ""}#recent-clicks`;
}

export default async function LinkDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const recentPage = normalizeRecentClickPage(query.clickPage);
  const recentPageSize = normalizeRecentClickPageSize(query.clickPageSize);
  const [link, settings] = await Promise.all([
    prisma.shortLink.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } } }
    }),
    getSettings()
  ]);
  if (!link) notFound();
  const { displayTimeZone, siteName } = settings;
  const csrf = getCsrfToken();
  const baseUrl = appBaseUrl();
  const stats = await clickStats(link.id, link.createdAt, displayTimeZone, {
    page: recentPage,
    pageSize: recentPageSize
  });
  const url = shortUrl(baseUrl, link.code);
  const activeDays = Math.max(1, stats.dailyHistory.length);
  const allTimeRate = stats.total / activeDays;
  const recentStart =
    stats.recentPagination.total === 0 ? 0 : (stats.recentPagination.page - 1) * stats.recentPagination.pageSize + 1;
  const recentEnd = Math.min(stats.recentPagination.total, recentStart + stats.recent.length - 1);
  const titleLabel = link.title || `Untitled ${siteName} link`;
  const expiresAtLabel = link.expiresAt ? formatDateTime(link.expiresAt, displayTimeZone) : "None";
  const maxClicksLabel = link.maxClicks ? link.maxClicks.toLocaleString() : "Unlimited";
  const descriptionLabel = link.description?.trim() || "None";
  const notesLabel = link.notes?.trim() || "None";
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
    <main className="admin-content">
      <div className="content-header">
        <div className="link-header-main">
          <div className="link-summary-row">
            <span className="link-summary-label">Title:</span>
            <strong>{titleLabel}</strong>
            {link.archivedAt ? <span className="badge warning">Archived</span> : null}
          </div>
          <div className="link-title-row">
            <h1>/{link.code}</h1>
            <CopyShortUrlButton url={url} />
            <EditLinkModal csrf={csrf} link={editableLink} />
          </div>
          <dl className="link-summary-list">
            <div className="link-summary-wide">
              <dt>Destination:</dt>
              <dd>
                <a href={link.destinationUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={13} aria-hidden />
                  {link.destinationUrl}
                </a>
              </dd>
            </div>
            <div className="link-summary-meta-item">
              <dt>Created on:</dt>
              <dd>{formatDateTime(link.createdAt, displayTimeZone)}</dd>
            </div>
            <div className="link-summary-meta-item">
              <dt>Expiration date:</dt>
              <dd>{expiresAtLabel}</dd>
            </div>
            <div className="link-summary-meta-item">
              <dt>Max Clicks:</dt>
              <dd>{maxClicksLabel}</dd>
            </div>
            <div className="link-summary-wide">
              <dt>Description:</dt>
              <dd>{descriptionLabel}</dd>
            </div>
            <div className="link-summary-wide">
              <dt>Internal Notes:</dt>
              <dd>{notesLabel}</dd>
            </div>
          </dl>
        </div>
        <div className="row-actions link-detail-actions">
          <QrCodeModal baseUrl={baseUrl} code={link.code} shortUrl={url} />
          <ShareButton url={url} title={link.title} defaultTitle={`${siteName} short link`} />
          <a className="button secondary icon-button" href={`/api/links/${link.id}/stats.csv`}>
            <Download size={16} aria-hidden />
            Export CSV
          </a>
        </div>
      </div>

      <section className="grid-3">
        <div className="metric">
          <span className="muted">Total clicks</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="metric">
          <span className="muted">Unique visits</span>
          <strong>{stats.unique}</strong>
        </div>
        <div className="metric">
          <span className="muted">Last clicked</span>
          <strong className="timestamp" style={{ fontSize: "1rem" }}>
            {link.lastClickedAt ? formatDateTime(link.lastClickedAt, displayTimeZone) : "Never"}
          </strong>
        </div>
      </section>

      <StatsTabs
        tabs={[
          {
            id: "history",
            label: "Historical clicks",
            children: (
              <HistoricalClicksPanel
                allTimeRate={allTimeRate}
                createdAtLabel={formatDateTime(link.createdAt, displayTimeZone)}
                dailyHistory={stats.dailyHistory}
                periodCounts={stats.periodCounts}
              />
            )
          },
          {
            id: "location",
            label: "Location",
            children: <LocationCharts rows={stats.countryCounts} />
          },
          {
            id: "sources",
            label: "Sources",
            children: (
              <SourcesCharts
                direct={stats.sourceCounts.direct}
                referrer={stats.sourceCounts.referrer}
                referrers={stats.sourceCounts.referrers}
              />
            )
          },
          {
            id: "browser-device",
            label: "Browser/device",
            children: (
              <BrowserDeviceCharts browsers={stats.byBrowser} devices={stats.byDevice} />
            )
          }
        ]}
      />

      <section className="surface surface-panel" id="recent-clicks">
        <div className="content-header recent-clicks-header">
          <div>
            <h2>Recent clicks</h2>
            <p className="muted small">
              Showing {recentStart}-{recentEnd} of {stats.recentPagination.total} clicks.
            </p>
          </div>
          <form className="row-actions recent-clicks-form" method="get" action={`/admin/links/${link.id}#recent-clicks`}>
            <input type="hidden" name="clickPage" value="1" />
            <label>
              Rows
              <input
                name="clickPageSize"
                type="number"
                min="1"
                max={MAX_RECENT_CLICK_PAGE_SIZE}
                defaultValue={stats.recentPagination.pageSize}
              />
            </label>
            <button className="secondary" type="submit">Apply</button>
          </form>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Country</th>
                <th>IP Address</th>
                <th>User Agent [Referrer]</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.length ? (
                stats.recent.map((click) => {
                  const occurredAtLabel = formatDateTime(click.occurredAt, displayTimeZone);
                  return (
                    <tr key={click.id}>
                      <td>
                        <span className="timestamp" title={`Database ID: ${click.id}`}>
                          {occurredAtLabel}
                        </span>
                      </td>
                      <td>{click.country || "Unknown"}</td>
                      <td className="ip-cell">{click.ipAddress || "Unknown"}</td>
                      <td className="user-agent-cell">
                        <span>{click.userAgent || "Unknown user agent"}</span>
                        <span className="muted small">[{click.referrer || "direct"}]</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4}>No clicks recorded for this link.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {stats.recentPagination.pageCount > 1 ? (
          <nav className="pagination" aria-label="Recent clicks pagination">
            {stats.recentPagination.page > 1 ? (
              <a
                className="button secondary"
                href={recentClicksHref(link.id, stats.recentPagination.page - 1, stats.recentPagination.pageSize)}
              >
                Previous
              </a>
            ) : (
              <span className="button secondary" aria-disabled="true">Previous</span>
            )}
            <span className="muted small">
              Page {stats.recentPagination.page} of {stats.recentPagination.pageCount}
            </span>
            {stats.recentPagination.page < stats.recentPagination.pageCount ? (
              <a
                className="button secondary"
                href={recentClicksHref(link.id, stats.recentPagination.page + 1, stats.recentPagination.pageSize)}
              >
                Next
              </a>
            ) : (
              <span className="button secondary" aria-disabled="true">Next</span>
            )}
          </nav>
        ) : null}
      </section>

      {link.archivedAt ? (
        <section className="surface surface-panel">
          <h2>Archive/Delete</h2>
          <p className="muted">
            This link is archived, hidden from active lists, and no longer redirects. Restore it to make it active again,
            or permanently delete it and its click history.
          </p>
          <div className="row-actions">
            <form action={restoreLinkAction}>
              <input type="hidden" name="csrf" value={csrf} />
              <input type="hidden" name="id" value={link.id} />
              <ConfirmButton className="secondary icon-button" type="submit" message={`Restore /${link.code}?`}>
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
                placeholder={`Type ${link.code}`}
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
        </section>
      ) : (
        <section className="surface surface-panel">
          <h2>Archive/Delete</h2>
          <p className="muted">Archived links stop redirecting and are hidden from normal dashboard lists.</p>
          <form action={archiveLinkAction}>
            <input type="hidden" name="csrf" value={csrf} />
            <input type="hidden" name="id" value={link.id} />
            <ConfirmButton className="danger" type="submit" message={`Archive this ${siteName} link?`}>
              <Archive size={16} aria-hidden />
              Archive
            </ConfirmButton>
          </form>
        </section>
      )}
    </main>
  );
}
