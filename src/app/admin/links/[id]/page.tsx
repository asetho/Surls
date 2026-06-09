import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Archive, Download, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyShareButtons } from "@/components/CopyShareButtons";
import { HistoricalClicksPanel } from "@/components/HistoricalClicksPanel";
import { QrCodeModal } from "@/components/QrCodeModal";
import { StatsTabs } from "@/components/StatsTabs";
import { TitleAutoFill } from "@/components/TitleAutoFill";
import { getCsrfToken } from "@/lib/csrf";
import { formatDateTime } from "@/lib/dates";
import { appBaseUrl } from "@/lib/env";
import { clickStats } from "@/lib/clicks";
import { shortUrl } from "@/lib/links";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { archiveLinkAction, deleteLinkAction, restoreLinkAction, updateLinkAction } from "../actions";

export const metadata: Metadata = {
  title: "Link Stats"
};

type PageProps = {
  params: Promise<{ id: string }>;
};

function CountBars({ rows, emptyLabel }: { rows: Array<{ label: string; count: number }>; emptyLabel: string }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  if (!rows.length) return <p className="muted">{emptyLabel}</p>;

  return (
    <div className="chart-bars">
      {rows.slice(0, 8).map((row) => (
        <div className="chart-row" key={row.label}>
          <span>{row.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(row.count / max) * 100}%`, display: "block" }} />
          </span>
          <span>{row.count}</span>
        </div>
      ))}
    </div>
  );
}

export default async function LinkDetailPage({ params }: PageProps) {
  const { id } = await params;
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
  const stats = await clickStats(link.id, link.createdAt, displayTimeZone);
  const url = shortUrl(baseUrl, link.code);
  const activeDays = Math.max(1, stats.dailyHistory.length);
  const allTimeRate = stats.total / activeDays;

  return (
    <main className="admin-content">
      <div className="content-header">
        <div>
          <h1>/{link.code}</h1>
          <p className="muted">
            {link.title || `Untitled ${siteName} link`}{" "}
            {link.archivedAt ? <span className="badge warning">Archived</span> : null}
          </p>
        </div>
        <CopyShareButtons url={url} title={link.title} defaultTitle={`${siteName} short link`} />
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
          <strong style={{ fontSize: "1rem" }}>
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
            children: (
              <div className="stats-card">
                <h2>Location</h2>
                <CountBars rows={stats.countryCounts} emptyLabel="No location data yet." />
              </div>
            )
          },
          {
            id: "sources",
            label: "Sources",
            children: (
              <div className="stats-card">
                <h2>Sources</h2>
                <div className="source-split">
                  <div>
                    <span className="muted small">Direct traffic</span>
                    <strong>{stats.sourceCounts.direct} hits</strong>
                  </div>
                  <div>
                    <span className="muted small">Referrer traffic</span>
                    <strong>{stats.sourceCounts.referrer} hits</strong>
                  </div>
                </div>
                <CountBars rows={stats.sourceCounts.referrers} emptyLabel="No referrer data yet." />
              </div>
            )
          },
          {
            id: "browser-device",
            label: "Browser/device",
            children: (
              <div className="stats-card">
                <h2>Browser/device</h2>
                <div className="stats-split-grid">
                  <div>
                    <h3>Browsers</h3>
                    <CountBars rows={stats.byBrowser} emptyLabel="No browser data yet." />
                  </div>
                  <div>
                    <h3>Devices</h3>
                    <CountBars rows={stats.byDevice} emptyLabel="No device data yet." />
                  </div>
                </div>
              </div>
            )
          }
        ]}
      />

      <section className="grid-3">
        <div className="surface" style={{ padding: "1rem" }}>
          <h2>QR code</h2>
          <p className="small muted">{url}</p>
          <QrCodeModal baseUrl={baseUrl} linkId={link.id} shortUrl={url} />
        </div>
        <div className="surface" style={{ padding: "1rem" }}>
          <h2>Exports</h2>
          <p className="muted small">Stats exclude admin clicks when Track admin clicks is off.</p>
          <a className="button secondary" href={`/api/links/${link.id}/stats.csv`}>
            <Download size={16} aria-hidden />
            Export stats CSV
          </a>
        </div>
      </section>

      <section className="surface" style={{ padding: "1rem" }}>
        <h2>Edit link</h2>
        <form className="form-stack" action={updateLinkAction} data-title-autofill="true">
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="id" value={link.id} />
          <div className="form-grid">
            <label>
              Destination URL
              <input name="destinationUrl" type="url" required defaultValue={link.destinationUrl} />
            </label>
            <label>
              Title
              <input name="title" defaultValue={link.title ?? ""} />
            </label>
            <label>
              Expiration date
              <input
                name="expiresAt"
                type="datetime-local"
                defaultValue={link.expiresAt ? link.expiresAt.toISOString().slice(0, 16) : ""}
              />
            </label>
            <label>
              Max clicks
              <input name="maxClicks" type="number" min="1" defaultValue={link.maxClicks ?? ""} />
            </label>
          </div>
          <label>
            <span>
              <input name="enabled" type="checkbox" defaultChecked={link.enabled} style={{ width: "auto", minHeight: "auto" }} />{" "}
              Enabled
            </span>
          </label>
          <label>
            Description
            <textarea name="description" defaultValue={link.description ?? ""} />
          </label>
          <label>
            Internal notes
            <textarea name="notes" defaultValue={link.notes ?? ""} />
          </label>
          <button type="submit">Save link</button>
        </form>
        <TitleAutoFill />
      </section>

      <section className="surface" style={{ padding: "1rem" }}>
        <h2>Recent clicks</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>ID</th>
                <th>Country</th>
                <th>IP Address</th>
                <th>User Agent [Referrer]</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.length ? (
                stats.recent.map((click) => (
                  <tr key={click.id}>
                    <td>{formatDateTime(click.occurredAt, displayTimeZone)}</td>
                    <td className="click-id">{click.id}</td>
                    <td>{click.country || "Unknown"}</td>
                    <td className="ip-cell">{click.ipAddress || "Unknown"}</td>
                    <td className="user-agent-cell">
                      <span>{click.userAgent || "Unknown user agent"}</span>
                      <span className="muted small">[{click.referrer || "direct"}]</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>No clicks recorded for this link.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {link.archivedAt ? (
        <section className="surface" style={{ padding: "1rem" }}>
          <h2>Archived link</h2>
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
                Restore link
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
                Delete forever
              </ConfirmButton>
            </form>
          </div>
        </section>
      ) : (
        <section className="surface" style={{ padding: "1rem" }}>
          <h2>Archive</h2>
          <p className="muted">Archived links stop redirecting and are hidden from normal dashboard lists.</p>
          <form action={archiveLinkAction}>
            <input type="hidden" name="csrf" value={csrf} />
            <input type="hidden" name="id" value={link.id} />
            <ConfirmButton className="danger" type="submit" message={`Archive this ${siteName} link?`}>
              <Archive size={16} aria-hidden />
              Archive link
            </ConfirmButton>
          </form>
        </section>
      )}
    </main>
  );
}
