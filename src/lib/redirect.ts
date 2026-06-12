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
import { publicWebrootNotFoundResponse } from "./webroot";

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

async function unavailableResponse(reason: string) {
  const siteName = escapeHtml(await getSiteName());
  return new NextResponse(
    `<!doctype html><html><head><title>${siteName} link unavailable</title></head><body><h1>Short URL unavailable</h1><p>${escapeHtml(reason)}</p><p><a href="/">Go home</a></p></body></html>`,
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
    return unavailableResponse(reason);
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
      return unavailableResponse("This short URL has reached its click limit.");
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
