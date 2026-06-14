import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Link2, LogIn, Plus } from "lucide-react";
import { BookmarkletPopupActions } from "@/components/BookmarkletPopupActions";
import { PasskeyLoginButton } from "@/components/PasskeyLoginButton";
import { TitleAutoFill } from "@/components/TitleAutoFill";
import { requireAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { dashboardThemeCssVariables } from "@/lib/dashboard-theme";
import { appBaseUrl } from "@/lib/env";
import { shortUrl } from "@/lib/links";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { createBookmarkletLinkAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bookmarklet"
};

type SearchParams = Promise<{
  createError?: string;
  created?: string;
  email?: string;
  error?: string;
  title?: string;
  twoFactor?: string;
  url?: string;
}>;

function compactValue(value: string | undefined, limit: number) {
  return (value ?? "").trim().slice(0, limit);
}

function bookmarkletPath(destinationUrl: string, title: string) {
  const params = new URLSearchParams();
  if (destinationUrl) params.set("url", destinationUrl);
  if (title) params.set("title", title);
  const query = params.toString();
  return query ? `/bookmarklet?${query}` : "/bookmarklet";
}

export default async function BookmarkletPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [user, settings] = await Promise.all([requireAdmin(), getSettings()]);
  const csrf = getCsrfToken();
  const siteName = settings.siteName;
  const themeStyle = dashboardThemeCssVariables(settings.dashboardTheme) as CSSProperties;
  const destinationUrl = compactValue(params.url, 2048);
  const title = compactValue(params.title, 240);
  const nextPath = bookmarkletPath(destinationUrl, title);
  const needsSecondFactor = params.twoFactor === "1";
  const createdLink = user && params.created
    ? await prisma.shortLink.findUnique({ where: { id: params.created } })
    : null;
  const createdUrl = createdLink ? shortUrl(appBaseUrl(), createdLink.code) : null;
  const hasFaviconBrandMark = Boolean(settings.favicons?.assets.faviconSvg);

  return (
    <main className="bookmarklet-shell" style={themeStyle}>
      <section className="bookmarklet-mini" aria-label={`${siteName} bookmarklet`}>
        <div className="bookmarklet-mini-brand">
          <span className={hasFaviconBrandMark ? "brand-mark brand-mark-favicon" : "brand-mark"}>
            {hasFaviconBrandMark ? (
              <Image src="/favicon.svg" alt="" aria-hidden="true" width={34} height={34} unoptimized />
            ) : (
              siteName.slice(0, 1).toUpperCase() || "S"
            )}
          </span>
          <div>
            <strong>{siteName}</strong>
            <span className="muted small">Bookmarklet</span>
          </div>
        </div>

        {!user ? (
          <form className="surface bookmarklet-card form-stack" action="/api/auth/login" method="post">
            <div className="bookmarklet-card-header">
              <LogIn size={20} aria-hidden />
              <div>
                <h1>Log in</h1>
                <p className="muted small">Sign in to create this short URL.</p>
              </div>
            </div>
            {params.error ? <div className="alert">{params.error}</div> : null}
            {needsSecondFactor ? <div className="success">Enter your 2FA code or one unused backup code.</div> : null}
            <input type="hidden" name="csrf" value={csrf} />
            <input type="hidden" name="next" value={nextPath} />
            <input type="hidden" name="loginContext" value="bookmarklet" />
            <label>
              Email
              <input name="email" type="email" autoComplete="username" required defaultValue={params.email ?? ""} />
            </label>
            <label>
              Password
              <input name="password" type="password" autoComplete="current-password" required minLength={12} />
            </label>
            <label>
              2FA or backup code
              <input
                name="secondFactor"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={needsSecondFactor ? "Required" : "Required only after 2FA is enabled"}
              />
            </label>
            <button type="submit">Log in</button>
            <div className="login-divider">
              <span>or</span>
            </div>
            <PasskeyLoginButton nextPath={nextPath} />
          </form>
        ) : createdLink && createdUrl ? (
          <div className="surface bookmarklet-card form-stack">
            <div className="bookmarklet-card-header">
              <Link2 size={20} aria-hidden />
              <div>
                <h1>Short URL created</h1>
                <p className="muted small">/{createdLink.code}</p>
              </div>
            </div>
            <BookmarkletPopupActions detailsHref={`/admin/links/${createdLink.id}`} url={createdUrl} />
            <dl className="bookmarklet-summary">
              <div>
                <dt>Destination</dt>
                <dd>
                  <a href={createdLink.destinationUrl} target="_blank">
                    <ExternalLink size={13} aria-hidden /> {createdLink.destinationUrl}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Title</dt>
                <dd>{createdLink.title || "Untitled"}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <form className="surface bookmarklet-card form-stack" action={createBookmarkletLinkAction} data-title-autofill="true">
            <div className="bookmarklet-card-header">
              <Plus size={20} aria-hidden />
              <div>
                <h1>Create short URL</h1>
                <p className="muted small">Signed in as {user.name || user.email}</p>
              </div>
            </div>
            {params.createError ? <div className="alert">{params.createError}</div> : null}
            <input type="hidden" name="csrf" value={csrf} />
            <input type="hidden" name="returnTo" value={nextPath} />
            <label>
              Destination URL
              <input
                name="destinationUrl"
                type="url"
                placeholder="https://example.com/page"
                required
                defaultValue={destinationUrl}
                autoFocus
              />
            </label>
            <label>
              Title
              <input name="title" defaultValue={title} />
            </label>
            <div className="form-grid bookmarklet-form-grid">
              <label>
                Custom alias
                <input name="code" placeholder="optional-alias" pattern="[A-Za-z0-9_-]{3,64}" />
              </label>
              <label>
                Tags
                <input name="tags" placeholder="work, docs" />
              </label>
            </div>
            <div className="row-actions bookmarklet-popup-actions">
              <button type="submit">Create short URL</button>
              <Link className="button secondary" href="/admin" target="_blank">
                Open dashboard
              </Link>
            </div>
          </form>
        )}
      </section>
      <TitleAutoFill />
    </main>
  );
}
