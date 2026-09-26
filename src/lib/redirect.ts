import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession, isAdminUser } from "./auth";
import { getSetting, getSiteName } from "./settings";
import { prisma } from "./prisma";
import { linkUnavailableReason } from "./links";
import { recordClick } from "./clicks";
import { checkRateLimit } from "./rate-limit";
import { requestIpHash } from "./request";
import { appendForwardedQuery, assertNoPrivateResolutionWithTimeout } from "./url-safety";
import { appBaseUrl } from "./env";
import { DEFAULT_DASHBOARD_THEME } from "./dashboard-theme";
import { publicWebrootNotFoundResponse, publicWebrootResponse } from "./webroot";
import { checkPublicLinkLookupRate, publicLinkLookupRateLimitResponse } from "./public-link-lookup";
import { grantUploadDownloadUrl } from "./upload-grants";
import { uploadedFilenameFromDestination } from "./uploads";

export const REDIRECT_ANALYTICS_RATE_LIMIT = {
  limit: 120,
  windowMs: 60 * 1000
} as const;

export const REDIRECT_DESTINATION_DNS_CHECK = {
  timeoutMs: 2_000
} as const;

const redirectDestinationChecks = new Map<string, Promise<void>>();

async function assertSafeRedirectDestination(destinationUrl: string) {
  const hostname = new URL(destinationUrl).hostname.toLowerCase();
  const existing = redirectDestinationChecks.get(hostname);
  if (existing) return existing;

  const check = assertNoPrivateResolutionWithTimeout(
    destinationUrl,
    REDIRECT_DESTINATION_DNS_CHECK.timeoutMs,
    { purpose: "redirect" }
  ).then(() => undefined);
  redirectDestinationChecks.set(hostname, check);
  try {
    await check;
  } finally {
    if (redirectDestinationChecks.get(hostname) === check) {
      redirectDestinationChecks.delete(hostname);
    }
  }
}

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

function unavailableFallbackThemeCss() {
  const light = DEFAULT_DASHBOARD_THEME.light;
  const dark = DEFAULT_DASHBOARD_THEME.dark;

  return {
    dark,
    darkShadow: `0 18px 50px ${dark.shadowColor}47`,
    light,
    lightShadow: `0 18px 50px ${light.shadowColor}1f`
  };
}

function unavailableFallbackHtml(siteName: string, reason: string) {
  const escapedSiteName = escapeHtml(siteName);
  const theme = unavailableFallbackThemeCss();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="${theme.light.background}">
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="${theme.dark.background}">
  <title>Short URL unavailable | ${escapedSiteName}</title>
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <style>
    :root {
      color-scheme: light dark;
      --background: ${theme.light.background};
      --surface: ${theme.light.surface};
      --text: ${theme.light.text};
      --muted: ${theme.light.muted};
      --border: ${theme.light.border};
      --accent: ${theme.light.accent};
      --shadow: ${theme.lightShadow};
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --background: ${theme.dark.background};
        --surface: ${theme.dark.surface};
        --text: ${theme.dark.text};
        --muted: ${theme.dark.muted};
        --border: ${theme.dark.border};
        --accent: ${theme.dark.accent};
        --shadow: ${theme.darkShadow};
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

async function unavailableResponse(reason: string, isHead = false, status = 410) {
  const customUnavailablePage = await publicWebrootResponse(["unavailable.html"], {
    cacheControl: "private, no-store, max-age=0",
    method: isHead ? "HEAD" : "GET",
    status
  });
  if (customUnavailablePage) return customUnavailablePage;

  const siteName = await getSiteName();
  return new NextResponse(
    isHead ? null : unavailableFallbackHtml(siteName, reason),
    {
      status,
      headers: {
        "cache-control": "private, no-store, max-age=0",
        "content-type": "text/html; charset=utf-8",
        expires: "0",
        pragma: "no-cache"
      }
    }
  );
}

type ShortRedirectOptions = {
  missingLinkResponse?: () => Promise<Response>;
};

export async function handleShortRedirect(request: NextRequest, code: string, isHead = false, options: ShortRedirectOptions = {}) {
  const lookupRate = await checkPublicLinkLookupRate(request);
  if (!lookupRate.allowed) return publicLinkLookupRateLimitResponse(isHead);

  const link = await prisma.shortLink.findUnique({ where: { code } });
  if (!link) {
    if (options.missingLinkResponse) return options.missingLinkResponse();
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
  let forwardedDestination: string;
  try {
    forwardedDestination = preserveRedirectQuery
      ? appendForwardedQuery(link.destinationUrl, request.nextUrl.searchParams.toString())
      : link.destinationUrl;
    if (!uploadedFilenameFromDestination(forwardedDestination)) {
      await assertSafeRedirectDestination(forwardedDestination);
    }
  } catch {
    return unavailableResponse("This short URL destination could not be safely resolved.", isHead, 502);
  }
  const isAdminClick = isAdminUser(session?.user);
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
  let shouldStoreAggregateOnly =
    !shouldStoreEvent &&
    (link.maxClicks !== null || (!isHead && Boolean(optOutReason) && !adminIgnored));

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

  const destination = grantUploadDownloadUrl(forwardedDestination, link.id, isHead ? "HEAD" : "GET");
  const response = setNoStoreHeaders(NextResponse.redirect(destination, 302));
  if (adminIgnored) {
    response.headers.set("X-ShortURL-Admin-Click", "ignored");
  }
  if (analyticsSkipReason) {
    response.headers.set("X-ShortURL-Analytics", analyticsSkipReason);
  }
  return response;
}
