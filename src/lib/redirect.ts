import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "./auth";
import { getSetting, getSiteName } from "./settings";
import { prisma } from "./prisma";
import { linkUnavailableReason } from "./links";
import { recordClick } from "./clicks";
import { appendForwardedQuery } from "./url-safety";
import { appBaseUrl } from "./env";
import { publicWebrootNotFoundResponse } from "./webroot";

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
  isHead: boolean;
  isAdminClick: boolean;
  isAdminReferrer?: boolean;
  trackAdminClicks: boolean;
}) {
  const adminOriginated = input.isAdminClick || Boolean(input.isAdminReferrer);
  return !input.isHead && (!adminOriginated || input.trackAdminClicks);
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
      headers: { "content-type": "text/html; charset=utf-8" }
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
  const shouldRecord = shouldRecordRedirectClick({ isHead, isAdminClick, isAdminReferrer: adminReferrer, trackAdminClicks });

  if (shouldRecord) {
    const recorded = await recordClick({ maxClicks: link.maxClicks, shortLinkId: link.id, request });
    if (!recorded) {
      return unavailableResponse("This short URL has reached its click limit.");
    }
  }

  const destination = preserveRedirectQuery
    ? appendForwardedQuery(link.destinationUrl, request.nextUrl.searchParams.toString())
    : link.destinationUrl;
  const response = NextResponse.redirect(destination, 302);
  if ((isAdminClick || adminReferrer) && !trackAdminClicks) {
    response.headers.set("X-ShortURL-Admin-Click", "ignored");
  }
  return response;
}
