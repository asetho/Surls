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

function loginRedirect(request: NextRequest, error: string, extras?: Record<string, string>) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  for (const [key, value] of Object.entries(extras ?? {})) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  try {
    validateCsrf(formData);
  } catch {
    return loginRedirect(request, "The login form expired. Please try again.");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const secondFactor = String(formData.get("secondFactor") ?? "").trim();
  const nextPath = String(formData.get("next") ?? "/admin");

  const rate = checkRateLimit(`login:${requestIp(request)}:${email}`, 8, 15 * 60 * 1000);
  if (!rate.allowed) {
    return loginRedirect(request, "Too many login attempts. Please wait and try again.");
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
    return loginRedirect(request, "Invalid email or password.");
  }

  if (user.totpCredential?.enabled) {
    if (!secondFactor) {
      return loginRedirect(request, "Enter your 2FA code to continue.", { twoFactor: "1", email });
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
      return loginRedirect(request, "Invalid 2FA or backup code.", { twoFactor: "1", email });
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

  const destination = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/admin";
  const response = NextResponse.redirect(new URL(destination, request.url), 303);
  setSessionCookie(response, token, expiresAt);
  return response;
}
