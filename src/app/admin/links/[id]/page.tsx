import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Archive, Download } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyShareButtons } from "@/components/CopyShareButtons";
import { TitleAutoFill } from "@/components/TitleAutoFill";
import { getCsrfToken } from "@/lib/csrf";
import { appBaseUrl } from "@/lib/env";
import { clickStats } from "@/lib/clicks";
import { shortUrl } from "@/lib/links";
import { prisma } from "@/lib/prisma";
import { archiveLinkAction, updateLinkAction } from "../actions";

export const metadata: Metadata = {
  title: "Link Stats"
};

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatDateTime(date: Date) {
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatDay(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function HistoryChart({ days }: { days: Array<{ date: string; count: number }> }) {
  const width = 760;
  const height = 260;
  const pad = 34;
  const max = Math.max(1, ...days.map((day) => day.count));
  const innerWidth = width - pad * 2;
  const innerHeight = height - pad * 2;
  const points = days.map((day, index) => {
    const x = days.length === 1 ? width / 2 : pad + (index / (days.length - 1)) * innerWidth;
    const y = height - pad - (day.count / max) * innerHeight;
    return { ...day, x, y };
  });
  const linePoints =
    points.length === 1
      ? [
          { ...points[0], x: pad },
          { ...points[0], x: width - pad }
        ]
      : points;
  const path = linePoints.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const area = linePoints.length
    ? `${pad},${height - pad} ${path} ${width - pad},${height - pad}`
    : "";
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = Math.round((max / 4) * index);
    const y = height - pad - (value / max) * innerHeight;
    return { value, y };
  });

  return (
    <div className="history-chart" aria-label="Historical click count">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        {grid.map((line, index) => (
          <g key={`${index}-${line.value}`}>
            <line x1={pad} x2={width - pad} y1={line.y} y2={line.y} />
            <text x={8} y={line.y + 4}>{line.value}</text>
          </g>
        ))}
        {area ? <polygon points={area} /> : null}
        {path ? <polyline points={path} /> : null}
        {points.length <= 90
          ? points.map((point) => (
              <circle key={point.date} cx={point.x} cy={point.y} r={3}>
                <title>{`${formatDay(point.date)}: ${point.count} hit${point.count === 1 ? "" : "s"}`}</title>
              </circle>
            ))
          : null}
      </svg>
      <div className="chart-axis-labels">
        <span>{days[0] ? formatDay(days[0].date) : "No clicks"}</span>
        <span>{days.at(-1) ? formatDay(days.at(-1)!.date) : ""}</span>
      </div>
    </div>
  );
}

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
  const link = await prisma.shortLink.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } }
  });
  if (!link) notFound();
  const csrf = getCsrfToken();
  const stats = await clickStats(link.id, link.createdAt);
  const url = shortUrl(appBaseUrl(), link.code);
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 180 });
  const maxBrowserCount = Math.max(1, ...stats.byBrowser.map((row) => row._count.browser));
  const activeDays = Math.max(1, stats.dailyHistory.length);
  const allTimeRate = stats.total / activeDays;

  return (
    <main className="admin-content">
      <div className="content-header">
        <div>
          <h1>/{link.code}</h1>
          <p className="muted">{link.title || "Untitled Surls link"}</p>
        </div>
        <CopyShareButtons url={url} title={link.title} />
      </div>

      <section className="grid-3">
        <div className="metric">
          <span className="muted">Total clicks</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="metric">
          <span className="muted">Unique-ish clicks</span>
          <strong>{stats.unique}</strong>
        </div>
        <div className="metric">
          <span className="muted">Last clicked</span>
          <strong style={{ fontSize: "1rem" }}>{link.lastClickedAt?.toLocaleString() ?? "Never"}</strong>
        </div>
      </section>

      <section className="surface stats-panel">
        <div>
          <h2>Historical click count</h2>
          <p className="muted small">
            Short URL created on {formatDateTime(link.createdAt)}. Stats exclude admin clicks when Track admin clicks is off.
          </p>
        </div>
        <div className="stats-history-grid">
          <HistoryChart days={stats.dailyHistory} />
          <div className="stats-summary">
            <div>
              <span>Last 24 hours</span>
              <strong>{stats.periodCounts.last24Hours} hits</strong>
            </div>
            <div>
              <span>Last 7 days</span>
              <strong>{stats.periodCounts.last7Days} hits</strong>
            </div>
            <div>
              <span>Last 30 days</span>
              <strong>{stats.periodCounts.last30Days} hits</strong>
            </div>
            <div>
              <span>All time</span>
              <strong>
                {stats.periodCounts.allTime} hits <span className="muted small">{allTimeRate.toFixed(1)} per day</span>
              </strong>
            </div>
            <div className="best-day">
              <span>Best day</span>
              <strong>
                {stats.bestDay.count} hits on {formatDay(stats.bestDay.date)}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section className="grid-3">
        <div className="surface stats-card">
          <h2>Location</h2>
          <CountBars rows={stats.countryCounts} emptyLabel="No location data yet." />
        </div>
        <div className="surface stats-card">
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
        <div className="surface stats-card">
          <h2>Browser/device</h2>
          <div className="chart-bars">
            {stats.byBrowser.length ? (
              stats.byBrowser.map((row) => (
                <div className="chart-row" key={row.browser ?? "Unknown"}>
                  <span>{row.browser ?? "Unknown"}</span>
                  <span className="bar-track">
                    <span
                      className="bar-fill"
                      style={{ width: `${(row._count.browser / maxBrowserCount) * 100}%`, display: "block" }}
                    />
                  </span>
                  <span>{row._count.browser}</span>
                </div>
              ))
            ) : (
              <p className="muted">No browser data yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid-3">
        <div className="surface" style={{ padding: "1rem" }}>
          <h2>QR code</h2>
          <div className="qr-box">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={`QR code for ${url}`} src={qr} width={180} height={180} />
          </div>
          <p className="small muted">{url}</p>
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
                    <td>{formatDateTime(click.occurredAt)}</td>
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

      <section className="surface" style={{ padding: "1rem" }}>
        <h2>Archive</h2>
        <p className="muted">Archived links stop redirecting and are hidden from normal dashboard lists.</p>
        <form action={archiveLinkAction}>
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="id" value={link.id} />
          <ConfirmButton className="danger" type="submit" message="Archive this Surls link?">
            <Archive size={16} aria-hidden />
            Archive link
          </ConfirmButton>
        </form>
      </section>
    </main>
  );
}
