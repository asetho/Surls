import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { appBaseUrl } from "@/lib/env";
import { validateCsrf } from "@/lib/csrf";
import {
  encodeExternalAuth, EXTERNAL_AUTH_COOKIE, externalAuthCookieOptions, externalAuthorizationUrl,
  newExternalAuthValues
} from "@/lib/external-auth";
import { getExternalProviderConfig } from "@/lib/external-provider-settings";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSetting } from "@/lib/settings";
import { requestIp, requestOriginMatchesApp } from "@/lib/request";
import { safeRedirectPath } from "@/lib/redirect-path";

type ProviderContext = { params: Promise<{ provider: string }> };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]!);
}

function linkAuthorizationPage(authorizationUrl: URL) {
  if (authorizationUrl.protocol !== "https:" && authorizationUrl.protocol !== "http:") {
    throw new Error("Unsupported authorization URL protocol.");
  }
  const url = escapeHtml(authorizationUrl.toString());
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${url}"><title>Connecting to sign-in provider</title></head><body><p>Connecting to sign-in provider…</p><p><a href="${url}">Continue</a></p></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
      }
    }
  );
}

async function start(request: NextRequest, context: ProviderContext, userId: string | null, nextValue: unknown) {
  if (!(await getSetting("externalLoginEnabled"))) {
    return NextResponse.json({ error: "External sign-in is disabled." }, { status: 403 });
  }
  const { provider } = await context.params;
  const config = await getExternalProviderConfig(provider);
  if (!config) {
    return NextResponse.json({ error: "Sign-in provider unavailable." }, { status: 404 });
  }
  const ip = requestIp(request);
  const rate = await checkRateLimit(`external-auth:start:${ip}`, ip === "unknown" ? 3_000 : 30, 15 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many sign-in attempts." }, { status: 429 });

  const nextPath = safeRedirectPath(nextValue, userId ? "/admin/profile" : "/admin");
  const values = newExternalAuthValues();
  try {
    const authorizationUrl = await externalAuthorizationUrl(config.provider, values.state, values.verifier, values.nonce, config);
    // A POST form cannot follow a cross-origin redirect under the profile page's
    // form-action 'self' CSP. Return a same-origin document that starts a new navigation.
    const response = userId ? linkAuthorizationPage(authorizationUrl) : NextResponse.redirect(authorizationUrl, 303);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(EXTERNAL_AUTH_COOKIE, encodeExternalAuth({ provider: config.key, ...values, nextPath, userId }), externalAuthCookieOptions());
    return response;
  } catch {
    return NextResponse.redirect(new URL(userId ? "/admin/profile?error=Sign-in%20provider%20unavailable." : "/admin?error=Sign-in%20provider%20unavailable.", appBaseUrl()), 303);
  }
}

export async function GET(request: NextRequest, context: ProviderContext) {
  return start(request, context, null, request.nextUrl.searchParams.get("next"));
}

export async function POST(request: NextRequest, context: ProviderContext) {
  if (!requestOriginMatchesApp(request)) {
    return NextResponse.redirect(new URL("/admin/profile?error=The%20request%20could%20not%20be%20verified.", appBaseUrl()), 303);
  }
  const formData = await request.formData();
  try {
    validateCsrf(formData);
  } catch {
    return NextResponse.redirect(new URL("/admin/profile?error=The%20form%20expired.%20Please%20try%20again.", appBaseUrl()), 303);
  }
  const session = await getCurrentSession();
  if (!session) return NextResponse.redirect(new URL("/admin?next=/admin/profile", appBaseUrl()), 303);
  return start(request, context, session.userId, "/admin/profile");
}
