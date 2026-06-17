import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "./auth";
import { getSetting, getSiteName } from "./settings";
import { prisma } from "./prisma";
import { linkUnavailableReason } from "./links";
import { recordClick } from "./clicks";
import { checkRateLimit } from "./rate-limit";
import { requestIpHash } from "./request";
import { appendForwardedQuery } from "./url-safety";
import { appBaseUrl } from "./env";
import { publicWebrootNotFoundResponse, publicWebrootResponse } from "./webroot";

export const REDIRECT_ANALYTICS_RATE_LIMIT = {
  limit: 120,
  windowMs: 60 * 1000
} as const;

export function isAdminReferrer(referrer: string | null, baseUrl = appBaseUrl()) {
  if (!referrer) return false;
  try {
    const referrerUrl = new URL(referrer);
    const appUrl = new URL(baseUrl);
    return referrerUrl.origin === appUrl.origin && referrerUrl.pathname.startsWith("/admin");
  } catch {
    return false;
  }
}

export function shouldRecordRedirectClick(input: {
  analyticsOptOut?: boolean;
  analyticsRateLimited?: boolean;
  isHead: boolean;
  isAdminClick: boolean;
  isAdminReferrer?: boolean;
  trackAdminClicks: boolean;
}) {
  const adminOriginated = input.isAdminClick || Boolean(input.isAdminReferrer);
  return !input.isHead && !input.analyticsOptOut && !input.analyticsRateLimited && (!adminOriginated || input.trackAdminClicks);
}

export function analyticsOptOutReason(headers: Headers) {
  if (headers.get("dnt")?.trim() === "1") return "dnt";
  if (headers.get("sec-gpc")?.trim() === "1") return "gpc";
  return null;
}

function setNoStoreHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function unavailableFallbackHtml(siteName: string, reason: string) {
  const escapedSiteName = escapeHtml(siteName);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#e9f2f6">
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#052f3b">
  <title>Short URL unavailable | ${escapedSiteName}</title>
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <style>
    :root {
      color-scheme: light dark;
      --background: #e9f2f6;
      --surface: #ffffff;
      --text: #0b2636;
      --muted: #477282;
      --border: #bdd8e4;
      --accent: #087e8b;
      --shadow: 0 18px 50px #0a5c701f;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --background: #052f3b;
        --surface: #0a5c70;
        --text: #f3fbff;
        --muted: #92c1d3;
        --border: #3c8ea0;
        --accent: #64abbb;
        --shadow: 0 18px 50px #00000047;
      }
    }
    * { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body {
      align-items: center;
      background: var(--background);
      color: var(--text);
      display: grid;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
      margin: 0;
      padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
    }
    main {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: var(--shadow);
      display: grid;
      gap: 0.8rem;
      margin: 0 auto;
      max-width: 38rem;
      padding: clamp(1.2rem, 5vw, 2rem);
      width: min(100%, 38rem);
    }
    h1 {
      font-size: clamp(1.8rem, 9vw, 2.5rem);
      line-height: 1;
      margin: 0;
    }
    p { margin: 0; }
    .muted { color: var(--muted); }
    a {
      color: var(--accent);
      font-weight: 800;
      overflow-wrap: anywhere;
    }
  </style>
</head>
<body>
  <main>
    <h1>Short URL unavailable</h1>
    <p class="muted">${escapeHtml(reason)}</p>
    <p><a href="/">Go home</a></p>
  </main>
</body>
</html>`;
}

async function unavailableResponse(reason: string, isHead = false) {
  const customUnavailablePage = await publicWebrootResponse(["unavailable.html"], {
    cacheControl: "private, no-store, max-age=0",
    method: isHead ? "HEAD" : "GET",
    status: 410
  });
  if (customUnavailablePage) return customUnavailablePage;

  const siteName = await getSiteName();
  return new NextResponse(
    isHead ? null : unavailableFallbackHtml(siteName, reason),
    {
      status: 410,
      headers: {
        "cache-control": "private, no-store, max-age=0",
        "content-type": "text/html; charset=utf-8",
        expires: "0",
        pragma: "no-cache"
      }
    }
  );
}

export async function handleShortRedirect(request: NextRequest, code: string, isHead = false) {
  const link = await prisma.shortLink.findUnique({ where: { code } });
  if (!link) {
    return publicWebrootNotFoundResponse({ method: isHead ? "HEAD" : "GET" });
  }

  const reason = linkUnavailableReason(link);
  if (reason) {
    return unavailableResponse(reason, isHead);
  }

  const [session, trackAdminClicks, preserveRedirectQuery] = await Promise.all([
    getCurrentSession(),
    getSetting("trackAdminClicks"),
    getSetting("preserveRedirectQuery")
  ]);
  const isAdminClick = Boolean(session);
  const adminReferrer = isAdminReferrer(request.headers.get("referer"));
  const adminIgnored = (isAdminClick || adminReferrer) && !trackAdminClicks;
  const optOutReason = analyticsOptOutReason(request.headers);
  let analyticsSkipReason: "admin" | "head" | "opted-out" | "rate-limited" | null = null;
  let shouldStoreEvent = shouldRecordRedirectClick({
    analyticsOptOut: Boolean(optOutReason),
    isHead,
    isAdminClick,
    isAdminReferrer: adminReferrer,
    trackAdminClicks
  });
  let shouldStoreAggregateOnly = !shouldStoreEvent && Boolean(optOutReason) && !isHead && !adminIgnored;

  if (!shouldStoreEvent) {
    if (isHead) {
      analyticsSkipReason = "head";
    } else if (optOutReason) {
      analyticsSkipReason = "opted-out";
    } else if (adminIgnored) {
      analyticsSkipReason = "admin";
    }
  }

  if (shouldStoreEvent || shouldStoreAggregateOnly) {
    const rate = await checkRateLimit(
      `redirect-click:${link.id}:${requestIpHash(request)}`,
      REDIRECT_ANALYTICS_RATE_LIMIT.limit,
      REDIRECT_ANALYTICS_RATE_LIMIT.windowMs
    );
    if (!rate.allowed) {
      shouldStoreEvent = false;
      shouldStoreAggregateOnly = link.maxClicks !== null;
      analyticsSkipReason = optOutReason ? "opted-out" : "rate-limited";
    }
  }

  if (shouldStoreEvent || shouldStoreAggregateOnly) {
    const recorded = await recordClick({
      maxClicks: link.maxClicks,
      request,
      shortLinkId: link.id,
      storeEvent: shouldStoreEvent
    });
    if (!recorded) {
      return unavailableResponse("This short URL has reached its click limit.", isHead);
    }
  }

  const destination = preserveRedirectQuery
    ? appendForwardedQuery(link.destinationUrl, request.nextUrl.searchParams.toString())
    : link.destinationUrl;
  const response = setNoStoreHeaders(NextResponse.redirect(destination, 302));
  if (adminIgnored) {
    response.headers.set("X-ShortURL-Admin-Click", "ignored");
  }
  if (analyticsSkipReason) {
    response.headers.set("X-ShortURL-Analytics", analyticsSkipReason);
  }
  return response;
}
