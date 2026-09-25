import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { appBaseUrl } from "@/lib/env";
import { validateCsrf } from "@/lib/csrf";
import {
  encodeExternalAuth, EXTERNAL_AUTH_COOKIE, externalAuthCookieOptions, externalAuthorizationUrl,
  externalProviderConfig, isExternalProvider, newExternalAuthValues
} from "@/lib/external-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestIp, requestOriginMatchesApp } from "@/lib/request";
import { safeRedirectPath } from "@/lib/redirect-path";

type ProviderContext = { params: Promise<{ provider: string }> };

async function start(request: NextRequest, context: ProviderContext, userId: string | null, nextValue: unknown) {
  const { provider } = await context.params;
  if (!isExternalProvider(provider) || !externalProviderConfig(provider)) {
    return NextResponse.json({ error: "Sign-in provider unavailable." }, { status: 404 });
  }
  const ip = requestIp(request);
  const rate = await checkRateLimit(`external-auth:start:${ip}`, ip === "unknown" ? 3_000 : 30, 15 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many sign-in attempts." }, { status: 429 });

  const nextPath = safeRedirectPath(nextValue, userId ? "/admin/profile" : "/admin");
  const values = newExternalAuthValues();
  try {
    const authorizationUrl = await externalAuthorizationUrl(provider, values.state, values.verifier, values.nonce);
    const response = NextResponse.redirect(authorizationUrl, 303);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(EXTERNAL_AUTH_COOKIE, encodeExternalAuth({ provider, ...values, nextPath, userId }), externalAuthCookieOptions());
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
