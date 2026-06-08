import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "./auth";
import { getSetting } from "./settings";
import { prisma } from "./prisma";
import { linkUnavailableReason } from "./links";
import { recordClick } from "./clicks";
import { appendForwardedQuery } from "./url-safety";

export function shouldRecordRedirectClick(input: { isHead: boolean; isAdminClick: boolean; trackAdminClicks: boolean }) {
  return !input.isHead && (!input.isAdminClick || input.trackAdminClicks);
}

export async function handleShortRedirect(request: NextRequest, code: string, isHead = false) {
  const link = await prisma.shortLink.findUnique({ where: { code } });
  if (!link) {
    return new NextResponse(
      `<!doctype html><html><head><title>Surls short URL not found</title><style>body{font-family:system-ui,sans-serif;background:#f7fbfd;color:#0b2636;margin:0;display:grid;place-items:center;min-height:100vh}.card{max-width:680px;background:white;border:1px solid #cfe3ef;border-radius:8px;padding:24px;box-shadow:0 18px 50px rgb(11 57 84 / .13)}button,a{border-radius:8px;padding:10px 14px;border:1px solid #cfe3ef;background:#087e8b;color:white;text-decoration:none;font-weight:700}a.secondary{background:white;color:#0b2636}</style></head><body><main class="card"><h1>That short URL was not found.</h1><p>The link may have been removed, mistyped, disabled, or never created.</p><p><button onclick="history.back()">Go back</button> <a class="secondary" href="/">Go home</a></p></main></body></html>`,
      {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" }
      }
    );
  }

  const reason = linkUnavailableReason(link);
  if (reason) {
    return new NextResponse(
      `<!doctype html><html><head><title>Surls link unavailable</title></head><body><h1>Short URL unavailable</h1><p>${reason}</p><p><a href="/">Go home</a></p></body></html>`,
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
  const shouldRecord = shouldRecordRedirectClick({ isHead, isAdminClick, trackAdminClicks });

  if (shouldRecord) {
    await recordClick({ shortLinkId: link.id, request });
  }

  const destination = preserveRedirectQuery
    ? appendForwardedQuery(link.destinationUrl, request.nextUrl.searchParams.toString())
    : link.destinationUrl;
  const response = NextResponse.redirect(destination, 302);
  if (isAdminClick && !trackAdminClicks) {
    response.headers.set("X-ShortURL-Admin-Click", "ignored");
  }
  return response;
}
