import { NextResponse, type NextRequest } from "next/server";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession, setSessionCookie } from "@/lib/auth";
import { verifyTotpCode } from "@/lib/totp";
import { verifyBackupCode } from "@/lib/backup-codes";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestIp, requestIpHash } from "@/lib/request";
import { auditLog } from "@/lib/audit";
import { validateCsrf } from "@/lib/csrf";
import { appBaseUrl } from "@/lib/env";

function safeInternalPath(value: string, fallback: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function loginRedirect(error: string, extras?: Record<string, string>, returnPath = "/login") {
  const url = new URL(safeInternalPath(returnPath, "/login"), appBaseUrl());
  url.searchParams.set("error", error);
  for (const [key, value] of Object.entries(extras ?? {})) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const nextPath = String(formData.get("next") ?? "/admin");
  const loginContext = String(formData.get("loginContext") ?? "");
  const failurePath = loginContext === "bookmarklet" ? safeInternalPath(nextPath, "/bookmarklet") : "/login";
  const failureExtras: Record<string, string> =
    loginContext === "bookmarklet" ? {} : { next: safeInternalPath(nextPath, "/admin") };

  try {
    validateCsrf(formData);
  } catch {
    return loginRedirect("The login form expired. Please try again.", failureExtras, failurePath);
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const secondFactor = String(formData.get("secondFactor") ?? "").trim();

  const rate = checkRateLimit(`login:${requestIp(request)}:${email}`, 8, 15 * 60 * 1000);
  if (!rate.allowed) {
    return loginRedirect("Too many login attempts. Please wait and try again.", failureExtras, failurePath);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { totpCredential: true, backupCodes: { where: { usedAt: null } } }
  });
  const passwordOk = user ? await verifyPassword(user.passwordHash, password) : false;

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
    if (!secondFactor) {
      return loginRedirect("Enter your 2FA code to continue.", { ...failureExtras, twoFactor: "1", email }, failurePath);
    }

    let secondFactorOk = await verifyTotpCode(user.totpCredential.secretEncrypted, secondFactor);
    let usedBackupCodeId: string | null = null;
    if (!secondFactorOk) {
      for (const backupCode of user.backupCodes) {
        if (await verifyBackupCode(backupCode.codeHash, secondFactor)) {
          secondFactorOk = true;
          usedBackupCodeId = backupCode.id;
          break;
        }
      }
    }
    if (!secondFactorOk) {
      await auditLog({
        userId: user.id,
        action: AuditAction.LOGIN_FAILURE,
        ipHash: requestIpHash(request),
        userAgent: request.headers.get("user-agent"),
        details: { email, secondFactor: true }
      });
      return loginRedirect("Invalid 2FA or backup code.", { ...failureExtras, twoFactor: "1", email }, failurePath);
    }
    if (usedBackupCodeId) {
      await prisma.backupCode.update({ where: { id: usedBackupCodeId }, data: { usedAt: new Date() } });
      await auditLog({ userId: user.id, action: AuditAction.BACKUP_CODE_USED });
    }
  }

  const { token, expiresAt } = await createSession(user.id, request);
  await auditLog({
    userId: user.id,
    action: AuditAction.LOGIN_SUCCESS,
    ipHash: requestIpHash(request),
    userAgent: request.headers.get("user-agent")
  });

  const destination = safeInternalPath(nextPath, "/admin");
  const response = NextResponse.redirect(new URL(destination, appBaseUrl()), 303);
  setSessionCookie(response, token, expiresAt);
  return response;
}
