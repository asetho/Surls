import { AlertTriangle, CalendarClock, ExternalLink, Link2, MousePointerClick } from "lucide-react";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/env";
import { formatDateTime } from "@/lib/dates";
import { shortUrl } from "@/lib/links";
import { CopyShareButtons } from "@/components/CopyShareButtons";
import { LoginPageShell } from "@/components/LoginPageShell";
import { PasswordLoginForm } from "@/components/PasswordLoginForm";
import { requireAdmin, safeRedirectPath } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { pageFromFilesystem } from "@/lib/custom-pages";
import { getSettings } from "@/lib/settings";

type SearchParams = Promise<{
  email?: string;
  error?: string;
  next?: string;
}>;

export default async function AdminDashboard({ searchParams }: { searchParams: SearchParams }) {
  const [params, currentUser, requestHeaders] = await Promise.all([searchParams, requireAdmin(), headers()]);
  if (!currentUser) {
    const [settings, filesystemLoginPage] = await Promise.all([getSettings(), pageFromFilesystem("login")]);
    const customLoginPage = filesystemLoginPage ?? settings.customLoginPage;
    const nextPath = safeRedirectPath(params.next);
    const title = `${settings.siteName} login`;
    const tagline = "Sign in to manage private links, redirects, and click statistics.";
    return (
      <LoginPageShell
        customPage={customLoginPage}
        nonce={requestHeaders.get("x-nonce") ?? undefined}
        tagline={tagline}
        title={title}
      >
        <PasswordLoginForm
          csrf={getCsrfToken()}
          embedded={Boolean(customLoginPage)}
          email={params.email}
          error={params.error}
          nextPath={nextPath}
          siteName={settings.siteName}
        />
      </LoginPageShell>
    );
  }

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const week = new Date(now);
  week.setDate(now.getDate() - 7);
  const month = new Date(now);
  month.setMonth(now.getMonth() - 1);

  const [
    totalLinks,
    totalClicks,
    clicksToday,
    clicksWeek,
    clicksMonth,
    topLinks,
    recentLinks,
    recentClicks,
    attentionLinks,
    settings
  ] = await Promise.all([
    prisma.shortLink.count({ where: { archivedAt: null } }),
    prisma.clickEvent.count(),
    prisma.clickEvent.count({ where: { occurredAt: { gte: today } } }),
    prisma.clickEvent.count({ where: { occurredAt: { gte: week } } }),
    prisma.clickEvent.count({ where: { occurredAt: { gte: month } } }),
    prisma.shortLink.findMany({
      where: { archivedAt: null },
      orderBy: [{ clickCount: "desc" }, { createdAt: "desc" }],
      take: 6
    }),
    prisma.shortLink.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 6
    }),
    prisma.clickEvent.findMany({
      include: { shortLink: true },
      orderBy: { occurredAt: "desc" },
      take: 8
    }),
    prisma.shortLink.findMany({
      where: {
        archivedAt: null,
        OR: [{ enabled: false }, { expiresAt: { lte: now } }]
      },
      orderBy: { updatedAt: "desc" },
      take: 6
    }),
    getSettings()
  ]);
  const { displayTimeZone, siteName } = settings;

  return (
    <main className="admin-content">
      <div className="content-header content-header-topbar">
        <div>
          <h1>Dashboard</h1>
        </div>
      </div>

      <section className="grid-3 dashboard-metrics" aria-label="Dashboard metrics">
        <div className="metric">
          <span className="metric-label">
            <Link2 size={18} aria-hidden />
            <span className="muted">Total short URLs</span>
          </span>
          <strong>{totalLinks}</strong>
        </div>
        <div className="metric">
          <span className="metric-label">
            <MousePointerClick size={18} aria-hidden />
            <span className="muted">Total clicks</span>
          </span>
          <strong>{totalClicks}</strong>
        </div>
        <div className="metric">
          <span className="metric-label">
            <CalendarClock size={18} aria-hidden />
            <span className="muted">Today / week / month</span>
          </span>
          <strong>
            {clicksToday} / {clicksWeek} / {clicksMonth}
          </strong>
        </div>
      </section>

      <section className="surface surface-panel">
        <div className="content-header">
          <h2>Top links</h2>
        </div>
        <div className="table-wrap">
          <table className="responsive-table">
            <thead>
              <tr>
                <th>Short URL</th>
                <th>Destination</th>
                <th>Clicks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {topLinks.length ? (
                topLinks.map((link) => {
                  const url = shortUrl(appBaseUrl(), link.code);
                  return (
                    <tr key={link.id}>
                      <td data-label="Short URL">
                        <a className="short-url-pill" href={`/admin/links/${link.id}`}>{link.code}</a>
                      </td>
                      <td className="small" data-label="Destination">
                        <div className="muted small link-destination-title">{link.title || "Untitled"}</div>
                        <a href={link.destinationUrl} target="_blank" rel="noreferrer">
                          <ExternalLink size={13} aria-hidden /> {link.destinationUrl}
                        </a>
                      </td>
                      <td data-label="Clicks">{link.clickCount}</td>
                      <td data-label="Actions">
                        <CopyShareButtons url={url} title={link.title} defaultTitle={`${siteName} short link`} />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4}>No links yet. Create your first {siteName} short URL.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid-3">
        <div className="surface surface-panel dashboard-panel">
          <h2>Recently created</h2>
          {recentLinks.length ? (
            recentLinks.map((link) => (
              <p key={link.id}>
                <a href={`/admin/links/${link.id}`}>/{link.code}</a>
                <br />
                <span className="muted small timestamp">{formatDateTime(link.createdAt, displayTimeZone)}</span>
              </p>
            ))
          ) : (
            <p className="muted">No links have been created yet.</p>
          )}
        </div>
        <div className="surface surface-panel dashboard-panel">
          <h2>Recent clicks</h2>
          {recentClicks.length ? (
            recentClicks.map((click) => (
              <p key={click.id}>
                <a href={`/admin/links/${click.shortLinkId}`}>/{click.shortLink.code}</a>
                <br />
                <span className="muted small">
                  {click.browser || "Unknown"} on {click.device || "Unknown"} ·{" "}
                  <span className="timestamp">{formatDateTime(click.occurredAt, displayTimeZone)}</span>
                </span>
              </p>
            ))
          ) : (
            <p className="muted">No click activity yet.</p>
          )}
        </div>
        <div className="surface surface-panel dashboard-panel">
          <h2>
            <AlertTriangle size={18} aria-hidden /> Needs attention
          </h2>
          {attentionLinks.length ? (
            <div className="dashboard-attention-list">
              {attentionLinks.map((link) => (
                <p className="attention-row" key={link.id}>
                  <span className="badge warning">{link.enabled ? "Expired" : "Disabled"}</span>
                  <a href={`/admin/links/${link.id}`}>/{link.code}</a>
                </p>
              ))}
            </div>
          ) : (
            <p className="muted">No disabled or expired links need attention.</p>
          )}
        </div>
      </section>
    </main>
  );
}
