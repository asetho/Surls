import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Archive, Download, ExternalLink, RotateCcw } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyShortUrlButton, ShareButton } from "@/components/CopyShareButtons";
import { DeleteLinkModal } from "@/components/DeleteLinkModal";
import { BrowserDeviceCharts, SourcesCharts } from "@/components/DistributionCharts";
import { EditLinkModal } from "@/components/EditLinkModal";
import { HistoricalClicksPanel } from "@/components/HistoricalClicksPanel";
import { LocationCharts } from "@/components/LocationCharts";
import { QrCodeModal } from "@/components/QrCodeModal";
import { RecentClicksPanel } from "@/components/RecentClicksPanel";
import { StatsTabs } from "@/components/StatsTabs";
import { adminLoginPath } from "@/lib/admin-login-path";
import { isAdminUser, requireAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { formatDateTime } from "@/lib/dates";
import { appBaseUrl } from "@/lib/env";
import { clickStats, normalizeRecentClickPage, normalizeRecentClickPageSize } from "@/lib/clicks";
import { shortUrl } from "@/lib/links";
import { prisma } from "@/lib/prisma";
import { recentClicksView } from "@/lib/recent-clicks-view";
import { getSettings } from "@/lib/settings";
import { archiveLinkAction, restoreLinkAction } from "../actions";

export const metadata: Metadata = {
  title: "Link Stats"
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ clickPage?: string; clickPageSize?: string }>;
};

function linkDetailNextPath(id: string, query: Awaited<PageProps["searchParams"]>) {
  const urlParams = new URLSearchParams();
  if (query.clickPage) urlParams.set("clickPage", query.clickPage);
  if (query.clickPageSize) urlParams.set("clickPageSize", query.clickPageSize);
  const search = urlParams.toString();
  const path = `/admin/links/${encodeURIComponent(id)}`;
  return search ? `${path}?${search}` : path;
}

export default async function LinkDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, query, currentUser] = await Promise.all([params, searchParams, requireAdmin()]);
  if (!currentUser) redirect(adminLoginPath(linkDetailNextPath(id, query)));

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
  const canDeleteLinks = isAdminUser(currentUser);
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
  const recentClicks = recentClicksView(stats.recent, stats.recentPagination, displayTimeZone);
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
            <a
              className="button secondary icon-button icon-only-action"
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open /${link.code} in a new tab`}
              title={`Open /${link.code}`}
            >
              <ExternalLink size={16} aria-hidden />
            </a>
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
            children: <BrowserDeviceCharts browsers={stats.byBrowser} devices={stats.byDevice} />
          }
        ]}
      />

      <RecentClicksPanel initialData={recentClicks} linkId={link.id} />

      <section className="surface surface-panel">
        <h2>
          {link.archivedAt
            ? canDeleteLinks
              ? "Restore/Delete"
              : "Restore"
            : canDeleteLinks
              ? "Archive/Delete"
              : "Archive"}
        </h2>
        <p className="muted">
          {link.archivedAt
            ? "This link is archived, hidden from active lists, and no longer redirects. Restore it to make it active again."
            : "Archive stops this link from redirecting and hides it from active lists."}
        </p>
        <div className="row-actions link-lifecycle-actions">
          {link.archivedAt ? (
            <form action={restoreLinkAction}>
              <input type="hidden" name="csrf" value={csrf} />
              <input type="hidden" name="id" value={link.id} />
              <ConfirmButton className="secondary icon-button" type="submit" message={`Restore /${link.code}?`}>
                <RotateCcw size={16} aria-hidden />
                Restore
              </ConfirmButton>
            </form>
          ) : (
            <form action={archiveLinkAction}>
              <input type="hidden" name="csrf" value={csrf} />
              <input type="hidden" name="id" value={link.id} />
              <ConfirmButton className="danger" type="submit" message={`Archive this ${siteName} link?`}>
                <Archive size={16} aria-hidden />
                Archive
              </ConfirmButton>
            </form>
          )}
          {canDeleteLinks ? (
            <DeleteLinkModal
              csrf={csrf}
              id={link.id}
              code={link.code}
              shortUrl={url}
              returnTo={link.archivedAt ? "/admin/links?view=archived" : "/admin/links"}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
