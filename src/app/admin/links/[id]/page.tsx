import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Archive, Download } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyShareButtons } from "@/components/CopyShareButtons";
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

export default async function LinkDetailPage({ params }: PageProps) {
  const { id } = await params;
  const link = await prisma.shortLink.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } }
  });
  if (!link) notFound();
  const csrf = getCsrfToken();
  const stats = await clickStats(link.id);
  const url = shortUrl(appBaseUrl(), link.code);
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 180 });
  const maxBrowserCount = Math.max(1, ...stats.byBrowser.map((row) => row._count.browser));

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
        <form className="form-stack" action={updateLinkAction}>
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
      </section>

      <section className="surface" style={{ padding: "1rem" }}>
        <h2>Recent clicks</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Referrer</th>
                <th>Browser</th>
                <th>Device</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.length ? (
                stats.recent.map((click) => (
                  <tr key={click.id}>
                    <td>{click.occurredAt.toLocaleString()}</td>
                    <td>{click.referrer || "Direct"}</td>
                    <td>{click.browser || "Unknown"}</td>
                    <td>{click.device || "Unknown"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>No clicks recorded for this link.</td>
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
