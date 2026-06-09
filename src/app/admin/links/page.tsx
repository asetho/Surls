import type { Metadata } from "next";
import { ExternalLink, Plus } from "lucide-react";
import { CopyShareButtons } from "@/components/CopyShareButtons";
import { TitleAutoFill } from "@/components/TitleAutoFill";
import { getCsrfToken } from "@/lib/csrf";
import { appBaseUrl } from "@/lib/env";
import { shortUrl } from "@/lib/links";
import { prisma } from "@/lib/prisma";
import { getSiteName } from "@/lib/settings";
import { createLinkAction } from "./actions";

export const metadata: Metadata = {
  title: "Links"
};

type SearchParams = Promise<{ q?: string; sort?: string }>;

export default async function LinksPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = params.q?.trim();
  const csrf = getCsrfToken();
  const [links, siteName] = await Promise.all([
    prisma.shortLink.findMany({
      where: {
        archivedAt: null,
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" } },
                { title: { contains: q, mode: "insensitive" } },
                { destinationUrl: { contains: q, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: params.sort === "clicks" ? [{ clickCount: "desc" }] : [{ createdAt: "desc" }],
      include: { tags: { include: { tag: true } } },
      take: 100
    }),
    getSiteName()
  ]);

  return (
    <main className="admin-content">
      <div className="content-header">
        <div>
          <h1>Link management</h1>
          <p className="muted">Create, search, copy, share, edit, disable, archive, and inspect {siteName} links.</p>
        </div>
      </div>

      <section className="surface" style={{ padding: "1rem" }}>
        <h2>
          <Plus size={18} aria-hidden /> Create short URL
        </h2>
        <form className="form-stack" action={createLinkAction} data-title-autofill="true">
          <input type="hidden" name="csrf" value={csrf} />
          <div className="form-grid">
            <label>
              Destination URL
              <input name="destinationUrl" type="url" placeholder="https://example.com/page" required />
            </label>
            <label>
              Custom alias
              <input name="code" placeholder="optional-alias" pattern="[A-Za-z0-9_-]{3,64}" />
            </label>
            <label>
              Title
              <input name="title" />
            </label>
            <label>
              Tags
              <input name="tags" placeholder="work, docs, client" />
            </label>
            <label>
              Expiration date
              <input name="expiresAt" type="datetime-local" />
            </label>
            <label>
              Max clicks
              <input name="maxClicks" type="number" min="1" />
            </label>
          </div>
          <label>
            Description
            <textarea name="description" />
          </label>
          <label>
            Internal notes
            <textarea name="notes" />
          </label>
          <button type="submit">Create {siteName} link</button>
        </form>
        <TitleAutoFill />
      </section>

      <section className="surface" style={{ padding: "1rem" }}>
        <div className="content-header">
          <h2>All links</h2>
          <form className="row-actions">
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
                  const url = shortUrl(appBaseUrl(), link.code);
                  return (
                    <tr key={link.id}>
                      <td>
                        <a href={`/admin/links/${link.id}`}>/{link.code}</a>
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
                        <span className={link.enabled ? "badge" : "badge warning"}>{link.enabled ? "Active" : "Disabled"}</span>
                      </td>
                      <td>{link.clickCount}</td>
                      <td>
                        <CopyShareButtons url={url} title={link.title} defaultTitle={`${siteName} short link`} />
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
