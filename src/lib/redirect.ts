import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "./auth";
import { getSetting, getSiteName } from "./settings";
import { prisma } from "./prisma";
import { linkUnavailableReason } from "./links";
import { recordClick } from "./clicks";
import { appendForwardedQuery } from "./url-safety";
import { appBaseUrl } from "./env";

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

export async function handleShortRedirect(request: NextRequest, code: string, isHead = false) {
  const link = await prisma.shortLink.findUnique({ where: { code } });
  if (!link) {
    const siteName = escapeHtml(await getSiteName());
    return new NextResponse(
      `<!doctype html><html><head><title>${siteName} short URL not found</title><style>:root{--dark-teal:#0a5c70ff;--teal:#087e8bff;--pacific-blue:#64abbbff;--sky-blue-light:#92c1d3ff;--flag-red:#c81d25ff}body{font-family:system-ui,sans-serif;background:color-mix(in srgb,var(--sky-blue-light),white 84%);color:#0b2636;margin:0;display:grid;place-items:center;min-height:100vh}.card{max-width:680px;background:white;border:1px solid color-mix(in srgb,var(--pacific-blue),white 58%);border-radius:8px;padding:24px;box-shadow:0 18px 50px color-mix(in srgb,var(--dark-teal),transparent 84%)}button,a{border-radius:8px;padding:10px 14px;border:1px solid var(--pacific-blue);background:var(--teal);color:white;text-decoration:none;font-weight:700}a.secondary{background:white;color:#0b2636}</style></head><body><main class="card"><h1>That short URL was not found.</h1><p>The link may have been removed, mistyped, disabled, or never created.</p><p><button onclick="history.back()">Go back</button> <a class="secondary" href="/">Go home</a></p></main></body></html>`,
      {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" }
      }
    );
  }

  const reason = linkUnavailableReason(link);
  if (reason) {
    const siteName = escapeHtml(await getSiteName());
    return new NextResponse(
      `<!doctype html><html><head><title>${siteName} link unavailable</title></head><body><h1>Short URL unavailable</h1><p>${escapeHtml(reason)}</p><p><a href="/">Go home</a></p></body></html>`,
      {
        status: 410,
        headers: { "content-type": "text/html; charset=utf-8" }
      }
    );
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
    await recordClick({ shortLinkId: link.id, request });
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
