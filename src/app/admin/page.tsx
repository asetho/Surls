import { AlertTriangle, CalendarClock, Link2, MousePointerClick } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/env";
import { shortUrl } from "@/lib/links";
import { CopyShareButtons } from "@/components/CopyShareButtons";

export default async function AdminDashboard() {
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
    attentionLinks
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
    })
  ]);

  return (
    <main className="admin-content">
      <div className="content-header">
        <div>
          <h1>Surls dashboard</h1>
          <p className="muted">Overview of private short URLs and privacy-respecting click activity.</p>
        </div>
        <Link className="button" href="/admin/links">
          <Link2 size={16} aria-hidden />
          New short URL
        </Link>
      </div>

      <section className="grid-3" aria-label="Dashboard metrics">
        <div className="metric">
          <Link2 aria-hidden />
          <span className="muted">Total short URLs</span>
          <strong>{totalLinks}</strong>
        </div>
        <div className="metric">
          <MousePointerClick aria-hidden />
          <span className="muted">Total clicks</span>
          <strong>{totalClicks}</strong>
        </div>
        <div className="metric">
          <CalendarClock aria-hidden />
          <span className="muted">Today / week / month</span>
          <strong>
            {clicksToday} / {clicksWeek} / {clicksMonth}
          </strong>
        </div>
      </section>

      <section className="surface" style={{ padding: "1rem" }}>
        <div className="content-header">
          <h2>Top links</h2>
          <span className="muted small">Admin clicks excluded unless enabled in settings.</span>
        </div>
        <div className="table-wrap">
          <table>
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
                      <td>
                        <a href={`/admin/links/${link.id}`}>/{link.code}</a>
                        <div className="muted small">{link.title || "Untitled"}</div>
                      </td>
                      <td className="small">{link.destinationUrl}</td>
                      <td>{link.clickCount}</td>
                      <td>
                        <CopyShareButtons url={url} title={link.title} />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4}>No links yet. Create your first Surls short URL.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid-3">
        <div className="surface" style={{ padding: "1rem" }}>
          <h2>Recently created</h2>
          {recentLinks.length ? (
            recentLinks.map((link) => (
              <p key={link.id}>
                <a href={`/admin/links/${link.id}`}>/{link.code}</a>
                <br />
                <span className="muted small">{link.createdAt.toLocaleString()}</span>
              </p>
            ))
          ) : (
            <p className="muted">No links have been created yet.</p>
          )}
        </div>
        <div className="surface" style={{ padding: "1rem" }}>
          <h2>Recent clicks</h2>
          {recentClicks.length ? (
            recentClicks.map((click) => (
              <p key={click.id}>
                <a href={`/admin/links/${click.shortLinkId}`}>/{click.shortLink.code}</a>
                <br />
                <span className="muted small">
                  {click.browser || "Unknown"} on {click.device || "Unknown"} · {click.occurredAt.toLocaleString()}
                </span>
              </p>
            ))
          ) : (
            <p className="muted">No click activity yet.</p>
          )}
        </div>
        <div className="surface" style={{ padding: "1rem" }}>
          <h2>
            <AlertTriangle size={18} aria-hidden /> Needs attention
          </h2>
          {attentionLinks.length ? (
            attentionLinks.map((link) => (
              <p key={link.id}>
                <a href={`/admin/links/${link.id}`}>/{link.code}</a>
                <br />
                <span className="badge warning">{link.enabled ? "Expired" : "Disabled"}</span>
              </p>
            ))
          ) : (
            <p className="muted">No disabled or expired links need attention.</p>
          )}
        </div>
      </section>
    </main>
  );
}
