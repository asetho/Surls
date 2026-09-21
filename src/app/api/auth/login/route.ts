import { NextResponse, type NextRequest } from "next/server";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession, safeRedirectPath, setSessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestIp, requestIpHash, requestOriginMatchesApp } from "@/lib/request";
import { auditLog } from "@/lib/audit";
import { validateCsrf } from "@/lib/csrf";
import { appBaseUrl } from "@/lib/env";
import { encodePendingLogin, PENDING_LOGIN_COOKIE, pendingLoginCookieOptions } from "@/lib/pending-login";
import { verifyTurnstileChallenge } from "@/lib/turnstile";

const DUMMY_PASSWORD_HASH = "$argon2id$v=19$m=19456,p=1,t=3$c3VybHMtbG9naW4tZHVtbXk$uccdR/gVmdReosoPXP3TFJjL/XDtwC+aBw4EBoflFVs";

function loginRedirect(error: string, extras?: Record<string, string>, returnPath = "/admin") {
  const url = new URL(safeRedirectPath(returnPath), appBaseUrl());
  url.searchParams.set("error", error);
  for (const [key, value] of Object.entries(extras ?? {})) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  if (!requestOriginMatchesApp(request)) {
    return loginRedirect("The login request could not be verified. Please try again.");
  }

  const formData = await request.formData();
  const nextPath = safeRedirectPath(formData.get("next"));
  const loginContext = String(formData.get("loginContext") ?? "");
  const failurePath = loginContext === "bookmarklet" ? safeRedirectPath(nextPath, "/bookmarklet") : "/admin";
  const failureExtras: Record<string, string> = loginContext === "bookmarklet" ? {} : { next: nextPath };

  try {
    validateCsrf(formData);
  } catch {
    return loginRedirect("The login form expired. Please try again.", failureExtras, failurePath);
  }

  const turnstile = await verifyTurnstileChallenge(formData, request);
  if (!turnstile.ok) {
    return loginRedirect("Complete the security check and try again.", failureExtras, failurePath);
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const rate = await checkRateLimit(`login:${requestIp(request)}:${email}`, 8, 15 * 60 * 1000);
  if (!rate.allowed) {
    return loginRedirect("Too many login attempts. Please wait and try again.", failureExtras, failurePath);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { totpCredential: true }
  });
  const passwordOk = await verifyPassword(user?.passwordHash ?? DUMMY_PASSWORD_HASH, password);

  if (!user || !passwordOk) {
    await auditLog({
      action: AuditAction.LOGIN_FAILURE,
      ipHash: requestIpHash(request),
      userAgent: request.headers.get("user-agent"),
      details: { email }
    });
    return loginRedirect("Invalid email or password.", failureExtras, failurePath);
  }

  if (user.totpCredential?.enabled) {
    const response = NextResponse.redirect(new URL("/admin/2fa", appBaseUrl()), 303);
    response.cookies.set(
      PENDING_LOGIN_COOKIE,
      encodePendingLogin({ email: user.email, nextPath, userId: user.id }),
      pendingLoginCookieOptions()
    );
    return response;
  }

  const { token, expiresAt } = await createSession(user.id, request);
  await auditLog({
    userId: user.id,
    action: AuditAction.LOGIN_SUCCESS,
    ipHash: requestIpHash(request),
    userAgent: request.headers.get("user-agent")
  });

  const response = NextResponse.redirect(new URL(nextPath, appBaseUrl()), 303);
  setSessionCookie(response, token, expiresAt);
  return response;
}
