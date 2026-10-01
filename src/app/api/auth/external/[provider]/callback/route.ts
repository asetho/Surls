import { AuditAction } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { auditLog } from "@/lib/audit";
import { createSession, getCurrentSession, setSessionCookie } from "@/lib/auth";
import { appBaseUrl } from "@/lib/env";
import {
  decodeExternalAuth, EXTERNAL_AUTH_COOKIE, expiredExternalAuthCookieOptions,
  externalProfile
} from "@/lib/external-auth";
import { beginExternalAuth } from "@/lib/external-auth-flow";
import { externalProviderKey, getExternalProviderConfig } from "@/lib/external-provider-settings";
import { ExternalIdentityError, resolveExternalIdentity } from "@/lib/external-identity";
import { hashToken } from "@/lib/crypto";
import { encodePendingLogin, PENDING_LOGIN_COOKIE, pendingLoginCookieOptions } from "@/lib/pending-login";
import { prisma } from "@/lib/prisma";
import { encodeProfileVerification, PROFILE_VERIFICATION_COOKIE, profileVerificationCookieOptions } from "@/lib/profile-verification";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestIpHash } from "@/lib/request";
import { getSetting } from "@/lib/settings";
import { encodeTotpSetupProof, TOTP_SETUP_PROOF_COOKIE, totpSetupProofCookieOptions } from "@/lib/totp-setup-proof";

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
  let continuedConnect = false;
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
    const current = pending.userId ? await getCurrentSession() : null;
    if (pending.userId && current?.userId !== pending.userId) throw new Error("Sign in again before connecting this provider.");
    if (pending.userId && (!pending.sessionId || current?.id !== pending.sessionId ||
        !["connect", "reauth", "verify-connect", "verify-totp-setup"].includes(pending.purpose ?? ""))) {
      throw new Error("Sign in again before connecting this provider.");
    }
    const callback = new URL(`${appBaseUrl()}${request.nextUrl.pathname}${request.nextUrl.search}`);
    const profile = await externalProfile(config.provider, callback, pending, config);
    if (pending.purpose === "reauth" || pending.purpose === "verify-connect" || pending.purpose === "verify-totp-setup") {
      const [identity, account] = await Promise.all([
        prisma.externalIdentity.findUnique({
          where: { provider_subject: { provider: externalProviderKey(config), subject: profile.subject } }, select: { userId: true, createdAt: true }
        }),
        prisma.user.findUnique({ where: { id: pending.userId! }, select: { totpCredential: { select: { enabled: true } } } })
      ]);
      const authenticatedAt = profile.authenticatedAt;
      if (!identity || identity.userId !== pending.userId || !current || identity.createdAt > current.createdAt || !account ||
          !["oidc", "google", "microsoft"].includes(config.provider) ||
          (pending.purpose === "verify-totp-setup" && account.totpCredential?.enabled) ||
          (account.totpCredential?.enabled && profile.mfaVerified !== true) ||
          typeof authenticatedAt !== "number" || !Number.isSafeInteger(authenticatedAt) ||
          authenticatedAt * 1000 < pending.issuedAt - 30_000 || authenticatedAt * 1000 > Date.now() + 30_000) {
        throw new ExternalIdentityError("The provider did not confirm a fresh sign-in to your linked account.");
      }
      if (pending.purpose === "reauth") {
        const action = pending.verificationAction ?? "email-change";
        response = NextResponse.redirect(new URL(`/admin/profile?verified=${action}`, appBaseUrl()), 303);
        response.cookies.set(PROFILE_VERIFICATION_COOKIE, encodeProfileVerification(pending.userId!, pending.sessionId!, pending.pendingEmail,
          action, pending.resourceId, profile.mfaVerified), profileVerificationCookieOptions());
      } else if (pending.purpose === "verify-totp-setup") {
        const liveSession = await getCurrentSession();
        if (liveSession?.id !== pending.sessionId || liveSession?.userId !== pending.userId) {
          throw new ExternalIdentityError("Sign in again before setting up TOTP.");
        }
        response = NextResponse.redirect(new URL("/admin/profile?totpVerified=1", appBaseUrl()), 303);
        response.cookies.set(TOTP_SETUP_PROOF_COOKIE, encodeTotpSetupProof(pending.userId!, pending.sessionId!), totpSetupProofCookieOptions());
      } else {
        const target = await getExternalProviderConfig(pending.targetProvider!);
        if (!target || !(await getSetting("externalLoginEnabled"))) throw new ExternalIdentityError("The provider you want to connect is unavailable.");
        const liveSession = await getCurrentSession();
        if (liveSession?.id !== pending.sessionId || liveSession?.userId !== pending.userId) {
          throw new ExternalIdentityError("Sign in again before connecting this provider.");
        }
        response = await beginExternalAuth(target, { userId: pending.userId!, sessionId: pending.sessionId!, purpose: "connect", nextPath: "/admin/profile" });
        continuedConnect = true;
      }
    } else {
      if (pending.userId) {
        if (pending.purpose !== "connect") throw new ExternalIdentityError("Verify your existing account before connecting this provider.");
        const liveSession = await getCurrentSession();
        if (liveSession?.id !== pending.sessionId || liveSession?.userId !== pending.userId) {
          throw new ExternalIdentityError("Sign in again before connecting this provider.");
        }
      }
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
    }
  } catch (error) {
    await auditLog({ action: AuditAction.LOGIN_FAILURE, ipHash: requestIpHash(request),
      userAgent: request.headers.get("user-agent"), details: { provider } }).catch(() => null);
    response = errorResponse(error instanceof ExternalIdentityError ? error.message : "External sign-in failed. Check the provider configuration or try again.", link);
  }
  if (!continuedConnect) response.cookies.set(EXTERNAL_AUTH_COOKIE, "", expiredExternalAuthCookieOptions());
  response.headers.set("Cache-Control", "no-store");
  return response;
}
