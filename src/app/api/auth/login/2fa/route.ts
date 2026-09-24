import { AuditAction } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { auditLog } from "@/lib/audit";
import { verifyBackupCode } from "@/lib/backup-codes";
import { createSession, setSessionCookie } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { appBaseUrl } from "@/lib/env";
import {
  decodePendingLogin,
  expiredPendingLoginCookieOptions,
  PENDING_LOGIN_COOKIE
} from "@/lib/pending-login";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestIp, requestIpHash, requestOriginMatchesApp } from "@/lib/request";
import { verifyTotpCode } from "@/lib/totp";
import { getSetting } from "@/lib/settings";

function pendingLoginRedirect(error: string, clearPending = false) {
  const url = new URL("/admin/2fa", appBaseUrl());
  url.searchParams.set("error", error);
  const response = NextResponse.redirect(url, 303);
  if (clearPending) {
    response.cookies.set(PENDING_LOGIN_COOKIE, "", expiredPendingLoginCookieOptions());
  }
  return response;
}

function restartLoginRedirect(error: string) {
  const url = new URL("/admin", appBaseUrl());
  url.searchParams.set("error", error);
  const response = NextResponse.redirect(url, 303);
  response.cookies.set(PENDING_LOGIN_COOKIE, "", expiredPendingLoginCookieOptions());
  return response;
}

export async function POST(request: NextRequest) {
  if (!requestOriginMatchesApp(request)) {
    return restartLoginRedirect("The login request could not be verified. Please try again.");
  }

  const formData = await request.formData();
  try {
    validateCsrf(formData);
  } catch {
    return pendingLoginRedirect("The 2FA form expired. Please try again.");
  }

  const pendingLogin = decodePendingLogin(request.cookies.get(PENDING_LOGIN_COOKIE)?.value);
  if (!pendingLogin) {
    return restartLoginRedirect("Sign in again to continue.");
  }
  if (pendingLogin.purpose === "login_2fa" && !(await getSetting("localLoginEnabled"))) {
    return restartLoginRedirect("Password sign-in is disabled. Choose an external provider.");
  }

  const [sourceRate, accountRate] = await Promise.all([
    checkRateLimit(`login-2fa:${requestIp(request)}:${pendingLogin.userId}`, 8, 15 * 60 * 1000),
    checkRateLimit(`login-2fa:account:${pendingLogin.userId}`, 8, 15 * 60 * 1000)
  ]);
  if (!sourceRate.allowed || !accountRate.allowed) {
    return pendingLoginRedirect("Too many 2FA attempts. Please wait and try again.");
  }

  const code = String(formData.get("code") ?? "").trim();
  const method = formData.get("method") === "backup" ? "backup" : "totp";
  if (!code) {
    return pendingLoginRedirect(method === "backup" ? "Enter a backup code." : "Enter your authenticator code.");
  }

  const user = await prisma.user.findUnique({
    where: { id: pendingLogin.userId },
    include: { totpCredential: true, backupCodes: { where: { usedAt: null } } }
  });
  if (!user || !user.totpCredential?.enabled) {
    return restartLoginRedirect("Sign in again to continue.");
  }

  let verified = false;
  let usedBackupCodeId: string | null = null;
  if (method === "backup") {
    for (const backupCode of user.backupCodes) {
      if (await verifyBackupCode(backupCode.codeHash, code)) {
        verified = true;
        usedBackupCodeId = backupCode.id;
        break;
      }
    }
  } else {
    verified = await verifyTotpCode(user.totpCredential.secretEncrypted, code);
  }

  if (!verified) {
    await auditLog({
      userId: user.id,
      action: AuditAction.LOGIN_FAILURE,
      ipHash: requestIpHash(request),
      userAgent: request.headers.get("user-agent"),
      details: { email: pendingLogin.email, method, secondFactor: true }
    });
    return pendingLoginRedirect(method === "backup" ? "Invalid backup code." : "Invalid authenticator code.");
  }

  if (usedBackupCodeId) {
    await prisma.backupCode.update({ where: { id: usedBackupCodeId }, data: { usedAt: new Date() } });
    await auditLog({ userId: user.id, action: AuditAction.BACKUP_CODE_USED });
  }

  const { token, expiresAt } = await createSession(user.id, request);
  await auditLog({
    userId: user.id,
    action: AuditAction.LOGIN_SUCCESS,
    ipHash: requestIpHash(request),
    userAgent: request.headers.get("user-agent"),
    details: { secondFactor: method, external: pendingLogin.purpose === "external_2fa" }
  });

  // The signed pending-login decoder normalizes nextPath with safeRedirectPath.
  // nosemgrep: javascript.express.open-redirect-deepsemgrep.open-redirect-deepsemgrep
  const response = NextResponse.redirect(new URL(pendingLogin.nextPath, appBaseUrl()), 303);
  response.cookies.set(PENDING_LOGIN_COOKIE, "", expiredPendingLoginCookieOptions());
  setSessionCookie(response, token, expiresAt);
  return response;
}
