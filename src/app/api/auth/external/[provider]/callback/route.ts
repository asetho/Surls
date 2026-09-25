import { AuditAction } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { auditLog } from "@/lib/audit";
import { createSession, getCurrentSession, setSessionCookie } from "@/lib/auth";
import { appBaseUrl } from "@/lib/env";
import {
  decodeExternalAuth, EXTERNAL_AUTH_COOKIE, expiredExternalAuthCookieOptions,
  externalProfile
} from "@/lib/external-auth";
import { getExternalProviderConfig } from "@/lib/external-provider-settings";
import { ExternalIdentityError, resolveExternalIdentity } from "@/lib/external-identity";
import { hashToken } from "@/lib/crypto";
import { encodePendingLogin, PENDING_LOGIN_COOKIE, pendingLoginCookieOptions } from "@/lib/pending-login";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestIpHash } from "@/lib/request";
import { getSetting } from "@/lib/settings";

function errorResponse(message: string, link: boolean) {
  const url = new URL(link ? "/admin/profile" : "/admin", appBaseUrl());
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const pending = decodeExternalAuth(request.cookies.get(EXTERNAL_AUTH_COOKIE)?.value);
  const link = Boolean(pending?.userId);
  let response: NextResponse;
  try {
    if (!(await getSetting("externalLoginEnabled"))) throw new Error("External sign-in is disabled.");
    const config = await getExternalProviderConfig(provider);
    if (!config || !pending || pending.provider !== provider) {
      throw new Error("The sign-in request expired. Please try again.");
    }
    if (request.nextUrl.searchParams.get("state") !== pending.state) throw new Error("The sign-in request could not be verified.");
    if (request.nextUrl.searchParams.has("error")) throw new Error("Sign-in was cancelled or refused by the provider.");
    const replay = await checkRateLimit(`external-auth:state:${hashToken(pending.state)}`, 1, 20 * 60 * 1000);
    if (!replay.allowed) throw new Error("This sign-in request has already been used.");
    if (pending.userId) {
      const current = await getCurrentSession();
      if (current?.userId !== pending.userId) throw new Error("Sign in again before connecting this provider.");
    }
    const callback = new URL(`${appBaseUrl()}${request.nextUrl.pathname}${request.nextUrl.search}`);
    const profile = await externalProfile(config.provider, callback, pending, config);
    const userId = await resolveExternalIdentity(config, profile, pending.userId);
    if (pending.userId) {
      response = NextResponse.redirect(new URL("/admin/profile?connected=1", appBaseUrl()), 303);
    } else {
      const user = await prisma.user.findUnique({
        where: { id: userId }, select: { email: true, totpCredential: { select: { enabled: true } } }
      });
      if (!user) throw new Error("The user no longer exists.");
      if (user.totpCredential?.enabled && profile.mfaVerified !== true) {
        response = NextResponse.redirect(new URL("/admin/2fa", appBaseUrl()), 303);
        response.cookies.set(PENDING_LOGIN_COOKIE, encodePendingLogin({
          email: user.email, nextPath: pending.nextPath, purpose: "external_2fa", userId
        }), pendingLoginCookieOptions());
      } else {
        const { token, expiresAt } = await createSession(userId, request);
        await auditLog({ userId, action: AuditAction.LOGIN_SUCCESS, ipHash: requestIpHash(request),
          userAgent: request.headers.get("user-agent"), details: { provider } });
        response = NextResponse.redirect(new URL(pending.nextPath, appBaseUrl()), 303);
        setSessionCookie(response, token, expiresAt);
      }
    }
  } catch (error) {
    await auditLog({ action: AuditAction.LOGIN_FAILURE, ipHash: requestIpHash(request),
      userAgent: request.headers.get("user-agent"), details: { provider } }).catch(() => null);
    response = errorResponse(error instanceof ExternalIdentityError ? error.message : "External sign-in failed. Check the provider configuration or try again.", link);
  }
  response.cookies.set(EXTERNAL_AUTH_COOKIE, "", expiredExternalAuthCookieOptions());
  response.headers.set("Cache-Control", "no-store");
  return response;
}
