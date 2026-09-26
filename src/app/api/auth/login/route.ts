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
import { getSetting } from "@/lib/settings";

const DUMMY_PASSWORD_HASH = "$argon2id$v=19$m=19456,p=1,t=3$c3VybHMtbG9naW4tZHVtbXk$uccdR/gVmdReosoPXP3TFJjL/XDtwC+aBw4EBoflFVs";
const MAX_LOGIN_BODY_BYTES = 64 * 1024;
const MAX_LOGIN_EMAIL_LENGTH = 320;
const MAX_LOGIN_PASSWORD_LENGTH = 4_096;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_PER_EMAIL_LIMIT = 8;
const LOGIN_PER_SOURCE_WORK_LIMIT = 48;
const MAX_CONCURRENT_PASSWORD_VERIFICATIONS = 4;
const CREDENTIAL_FAILURE_MINIMUM_MS = 300;
let activePasswordVerifications = 0;

async function readLoginFormData(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/x-www-form-urlencoded" && mediaType !== "multipart/form-data") return null;

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_LOGIN_BODY_BYTES) return null;
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_LOGIN_BODY_BYTES) {
        void reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return await new Request(request.url, {
      body: bytes,
      headers: { "content-type": contentType },
      method: "POST"
    }).formData();
  } catch {
    return null;
  }
}

async function verifyLoginCredentials(email: string, password: string) {
  if (activePasswordVerifications >= MAX_CONCURRENT_PASSWORD_VERIFICATIONS) return null;
  activePasswordVerifications += 1;
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { totpCredential: true }
    });
    return { user, passwordOk: await verifyPassword(user?.passwordHash ?? DUMMY_PASSWORD_HASH, password) };
  } finally {
    activePasswordVerifications -= 1;
  }
}

function loginRedirect(error: string, extras?: Record<string, string>, returnPath = "/admin") {
  const url = new URL(safeRedirectPath(returnPath), appBaseUrl());
  url.searchParams.set("error", error);
  for (const [key, value] of Object.entries(extras ?? {})) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  if (!(await getSetting("localLoginEnabled"))) {
    return loginRedirect("Password sign-in is disabled. Choose an external provider.");
  }
  if (!requestOriginMatchesApp(request)) {
    return loginRedirect("The login request could not be verified. Please try again.");
  }

  const formData = await readLoginFormData(request);
  if (!formData) return loginRedirect("Invalid email or password.");
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

  const sourceIp = requestIp(request);
  const credentialStartedAt = performance.now();
  const invalidCredentials = async (padFailure = sourceIp === "unknown") => {
    if (padFailure) {
      const remaining = CREDENTIAL_FAILURE_MINIMUM_MS - (performance.now() - credentialStartedAt);
      if (remaining > 0) await new Promise<void>((resolve) => setTimeout(resolve, Math.ceil(remaining)));
    }
    return loginRedirect("Invalid email or password.", failureExtras, failurePath);
  };

  const rawEmail = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (rawEmail.length > MAX_LOGIN_EMAIL_LENGTH || password.length > MAX_LOGIN_PASSWORD_LENGTH) {
    return invalidCredentials();
  }
  const email = rawEmail.trim().toLowerCase();
  if (email.length > MAX_LOGIN_EMAIL_LENGTH) {
    return invalidCredentials();
  }

  if (sourceIp !== "unknown") {
    const workRate = await checkRateLimit(`login:password-work:source:${sourceIp}`, LOGIN_PER_SOURCE_WORK_LIMIT, LOGIN_WINDOW_MS);
    if (!workRate.allowed) {
      return loginRedirect("Too many login attempts. Please wait and try again.", failureExtras, failurePath);
    }
    const rate = await checkRateLimit(`login:${sourceIp}:${email}`, LOGIN_PER_EMAIL_LIMIT, LOGIN_WINDOW_MS);
    if (!rate.allowed) {
      return loginRedirect("Too many login attempts. Please wait and try again.", failureExtras, failurePath);
    }
  }

  if (sourceIp === "unknown") {
    // A shared budget would let one visitor deny password sign-in to everyone
    // when the proxy does not provide a trusted client address.
    const rate = await checkRateLimit(`login:${sourceIp}:${email}`, LOGIN_PER_EMAIL_LIMIT, LOGIN_WINDOW_MS);
    if (!rate.allowed) return invalidCredentials();
  }

  const credentials = await verifyLoginCredentials(email, password);
  if (!credentials) {
    return invalidCredentials(true);
  }
  const { user, passwordOk } = credentials;

  if (!user || !passwordOk) {
    await auditLog({
      action: AuditAction.LOGIN_FAILURE,
      ipHash: requestIpHash(request),
      userAgent: request.headers.get("user-agent"),
      details: { email }
    });
    return invalidCredentials();
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
