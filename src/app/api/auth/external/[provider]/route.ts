import { NextResponse, type NextRequest } from "next/server";
import { AuditAction } from "@prisma/client";
import { auditLog } from "@/lib/audit";
import { getCurrentSession } from "@/lib/auth";
import { consumeBackupCode, matchingBackupCodeId } from "@/lib/backup-code-proof";
import { hashToken } from "@/lib/crypto";
import { appBaseUrl } from "@/lib/env";
import { validateCsrf } from "@/lib/csrf";
import { beginExternalAuth } from "@/lib/external-auth-flow";
import { createExternalConnectCode, decodeExternalConnectCode, EXTERNAL_CONNECT_CODE_COOKIE, externalConnectCodeCookieOptions, verifyExternalConnectCode } from "@/lib/external-connect-code";
import { externalProviderKey, getExternalProviderConfig } from "@/lib/external-provider-settings";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { profileEmailAvailable, sendExternalConnectCode } from "@/lib/profile-email";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSetting } from "@/lib/settings";
import { requestIp, requestOriginMatchesApp } from "@/lib/request";
import { safeRedirectPath } from "@/lib/redirect-path";
import { verifyTotpCode } from "@/lib/totp";
import type { ProfileVerificationAction } from "@/lib/profile-verification";

type ProviderContext = { params: Promise<{ provider: string }> };
type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;
type AuthIntent = { purpose: "connect" } | { purpose: "reauth"; pendingEmail?: string; verificationAction: ProfileVerificationAction; resourceId?: string } |
  { purpose: "verify-connect"; targetProvider: string } | { purpose: "verify-totp-setup" };

function connectError(message: string) {
  const url = new URL("/admin/profile", appBaseUrl());
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}

async function sendConnectCode(session: Session, targetProvider: string) {
  if (session.user.totpCredential?.enabled) return NextResponse.json({ error: "Use your authenticator to connect a provider." }, { status: 403 });
  if (!(await getSetting("localLoginEnabled"))) return NextResponse.json({ error: "Use a linked provider to verify your account." }, { status: 403 });
  if (!(await profileEmailAvailable())) return NextResponse.json({ error: "Email verification is not configured." }, { status: 503 });
  const rate = await checkRateLimit(`external-connect:send-code:${session.userId}`, 3, 15 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many codes requested. Please wait and try again." }, { status: 429 });
  const generated = createExternalConnectCode(session.userId, session.id, session.user.email, targetProvider);
  try {
    await sendExternalConnectCode(session.user.email, generated.code);
  } catch {
    return NextResponse.json({ error: "Could not send a verification code. Please try again later." }, { status: 503 });
  }
  const response = NextResponse.json({ message: `Verification code sent to ${session.user.email}.` });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(EXTERNAL_CONNECT_CODE_COOKIE, generated.cookie, externalConnectCodeCookieOptions());
  return response;
}

async function verifyConnectProof(request: NextRequest, session: Session, targetProvider: string, formData: FormData) {
  const method = formData.get("method");
  const code = String(formData.get("code") ?? "").trim();
  const credential = session.user.totpCredential;
  if (credential?.enabled) {
    const establishedAt = credential.enabledAt ?? credential.createdAt;
    if (!establishedAt || establishedAt > session.createdAt || (method !== "totp" && method !== "backup")) return false;
    const rate = await checkRateLimit(`external-connect:verify:${session.userId}`, 5, 15 * 60 * 1000);
    if (!rate.allowed || !code) return false;
    if (method === "backup") {
      const codeId = await matchingBackupCodeId(session.userId, code);
      if (!codeId) return false;
      const consumed = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${session.userId} FOR UPDATE`;
        const sessions = await tx.$queryRaw<Array<{ createdAt: Date; expiresAt: Date }>>`
          SELECT "createdAt", "expiresAt" FROM "Session" WHERE id = ${session.id} AND "userId" = ${session.userId} FOR UPDATE
        `;
        const liveSession = sessions[0];
        if (!liveSession || liveSession.expiresAt <= new Date() || liveSession.createdAt < establishedAt) return false;
        const liveCredential = await tx.totpCredential.findUnique({ where: { userId: session.userId } });
        if (!liveCredential?.enabled || liveCredential.id !== credential.id ||
            liveCredential.secretEncrypted !== credential.secretEncrypted) return false;
        return consumeBackupCode(tx, session.userId, codeId);
      });
      if (consumed) await auditLog({ userId: session.userId, action: AuditAction.BACKUP_CODE_USED });
      return consumed;
    }
    if (!(await verifyTotpCode(credential.secretEncrypted, code))) return false;
    const used = await checkRateLimit(`profile:totp-code:${session.userId}:${hashToken(code.replace(/\s+/g, ""))}`, 1, 90 * 1000);
    return used.allowed;
  }

  if (method === "password") {
    if (!(await getSetting("localLoginEnabled"))) return false;
    const password = String(formData.get("password") ?? "");
    if (!password || password.length > 4096) return false;
    const rate = await checkRateLimit(`external-connect:verify:${session.userId}`, 5, 15 * 60 * 1000);
    return rate.allowed && await verifyPassword(session.user.passwordHash, password);
  }
  if (method !== "email") return false;
  if (!(await getSetting("localLoginEnabled"))) return false;
  const rate = await checkRateLimit(`external-connect:verify:${session.userId}`, 5, 15 * 60 * 1000);
  if (!rate.allowed) return false;
  const password = String(formData.get("password") ?? "");
  if (!password || password.length > 4096 || !(await verifyPassword(session.user.passwordHash, password))) return false;
  const proof = decodeExternalConnectCode(request.cookies.get(EXTERNAL_CONNECT_CODE_COOKIE)?.value);
  if (!proof || proof.userId !== session.userId || proof.sessionId !== session.id ||
      proof.currentEmail !== session.user.email || proof.targetProvider !== targetProvider ||
      !verifyExternalConnectCode(proof, code)) return false;
  const used = await checkRateLimit(`external-connect:email-code:${hashToken(proof.nonce)}`, 1, 10 * 60 * 1000);
  return used.allowed;
}

async function start(request: NextRequest, context: ProviderContext, session: Session | null, nextValue: unknown, intent?: AuthIntent) {
  if (!(await getSetting("externalLoginEnabled"))) {
    return NextResponse.json({ error: "External sign-in is disabled." }, { status: 403 });
  }
  const { provider } = await context.params;
  const config = await getExternalProviderConfig(provider);
  if (!config) {
    return NextResponse.json({ error: "Sign-in provider unavailable." }, { status: 404 });
  }
  if (intent?.purpose === "reauth" || intent?.purpose === "verify-connect" || intent?.purpose === "verify-totp-setup") {
    if (!session?.createdAt || !["oidc", "google", "microsoft"].includes(config.provider) ||
        (intent.purpose === "verify-totp-setup" && session.user.totpCredential?.enabled)) {
      return connectError("This provider cannot verify that change.");
    }
    const linked = await prisma.externalIdentity.findFirst({
      where: { userId: session.userId, provider: externalProviderKey(config), createdAt: { lte: session.createdAt } }, select: { id: true }
    });
    if (!linked) return connectError("Connect this provider before using it for verification.");
    if (intent.purpose === "verify-connect" && !(await getExternalProviderConfig(intent.targetProvider))) {
      return connectError("The provider you want to connect is unavailable.");
    }
    if (intent.purpose === "reauth" && intent.verificationAction === "passkey-remove" &&
        !(await prisma.passkey.findFirst({ where: { id: intent.resourceId, userId: session.userId }, select: { id: true } }))) {
      return connectError("That passkey is no longer registered.");
    }
  }
  const ip = requestIp(request);
  const rate = await checkRateLimit(`external-auth:start:${ip}`, ip === "unknown" ? 3_000 : 30, 15 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many sign-in attempts." }, { status: 429 });

  const userId = session?.userId ?? null;
  const nextPath = safeRedirectPath(nextValue, userId ? "/admin/profile" : "/admin");
  try {
    if (!session) return await beginExternalAuth(config, { userId: null, nextPath });
    if (intent?.purpose === "reauth") return await beginExternalAuth(config, { userId: session.userId, sessionId: session.id, purpose: "reauth", pendingEmail: intent.pendingEmail, verificationAction: intent.verificationAction, resourceId: intent.resourceId, nextPath });
    if (intent?.purpose === "verify-connect") return await beginExternalAuth(config, { userId: session.userId, sessionId: session.id, purpose: "verify-connect", targetProvider: intent.targetProvider, nextPath });
    if (intent?.purpose === "verify-totp-setup") return await beginExternalAuth(config, { userId: session.userId, sessionId: session.id, purpose: "verify-totp-setup", nextPath });
    if (intent?.purpose === "connect") return await beginExternalAuth(config, { userId: session.userId, sessionId: session.id, purpose: "connect", nextPath });
    return connectError("Choose how to verify this connection.");
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
  if (!(await getSetting("externalLoginEnabled"))) return NextResponse.json({ error: "External sign-in is disabled." }, { status: 403 });
  const purpose = formData.get("purpose");
  if (purpose === "reauth") {
    const rawAction = String(formData.get("verificationAction") ?? "email-change");
    if (!["email-change", "passkey-add", "passkey-remove"].includes(rawAction)) return connectError("Choose a valid action to verify.");
    const verificationAction = rawAction as ProfileVerificationAction;
    const proposed = String(formData.get("pendingEmail") ?? "").trim().toLowerCase();
    const resourceId = String(formData.get("resourceId") ?? "");
    if (verificationAction === "email-change" && !(proposed.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proposed))) {
      return connectError("Enter a valid new email before verifying.");
    }
    if (verificationAction === "passkey-remove" && (!resourceId || resourceId.length > 128)) return connectError("Choose a passkey to remove.");
    if (verificationAction !== "email-change" && proposed) return connectError("Choose a valid action to verify.");
    if (verificationAction !== "passkey-remove" && resourceId) return connectError("Choose a valid action to verify.");
    return start(request, context, session, "/admin/profile", { purpose: "reauth",
      verificationAction, pendingEmail: verificationAction === "email-change" ? proposed : undefined,
      resourceId: verificationAction === "passkey-remove" ? resourceId : undefined });
  }
  if (purpose === "verify-connect") {
    const targetProvider = String(formData.get("targetProvider") ?? "");
    if (!targetProvider || !(await getExternalProviderConfig(targetProvider))) return connectError("The provider you want to connect is unavailable.");
    return start(request, context, session, "/admin/profile", { purpose: "verify-connect", targetProvider });
  }
  if (purpose === "verify-totp-setup") return start(request, context, session, "/admin/profile", { purpose: "verify-totp-setup" });
  if (purpose !== "connect" && purpose !== "send-connect-code") return connectError("Choose how to verify this connection.");
  const { provider } = await context.params;
  const config = await getExternalProviderConfig(provider);
  if (!config) return connectError("Sign-in provider unavailable.");
  if (purpose === "send-connect-code") return sendConnectCode(session, config.key);
  if (!(await verifyConnectProof(request, session, config.key, formData))) {
    return connectError("Verify your existing account before connecting this provider.");
  }
  const response = await start(request, context, session, "/admin/profile", { purpose: "connect" });
  if (formData.get("method") === "email") {
    response.cookies.set(EXTERNAL_CONNECT_CODE_COOKIE, "", { ...externalConnectCodeCookieOptions(), maxAge: 0 });
  }
  return response;
}
