import { AuditAction } from "@prisma/client";
import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { NextResponse, type NextRequest } from "next/server";
import { auditLog } from "@/lib/audit";
import { createSession, setSessionCookie } from "@/lib/auth";
import { hashToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import {
  decodePasskeyChallenge,
  expiredPasskeyCookieOptions,
  PASSKEY_AUTHENTICATION_COOKIE,
  PASSKEY_CHALLENGE_MAX_AGE_SECONDS,
  passkeyToWebAuthnCredential
} from "@/lib/passkeys";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { safeRedirectPath } from "@/lib/redirect-path";
import { readJsonBodyWithLimit, requestIp, requestIpHash } from "@/lib/request";
import { getSetting } from "@/lib/settings";
import { takePasskeyVerificationSlot } from "@/lib/passkey-auth-limits";

type AuthenticationPayload = {
  next?: string;
  response?: AuthenticationResponseJSON;
};

function loginDestination(value: unknown) {
  return safeRedirectPath(value);
}

async function authError(message: string, request: NextRequest, status = 400) {
  const response = NextResponse.json({ error: message }, { status });
  response.cookies.set(PASSKEY_AUTHENTICATION_COOKIE, "", expiredPasskeyCookieOptions());
  await auditLog({
    action: AuditAction.LOGIN_FAILURE,
    ipHash: requestIpHash(request),
    userAgent: request.headers.get("user-agent"),
    details: { passkey: true }
  }).catch(() => null);
  return response;
}

export async function POST(request: NextRequest) {
  if (!(await getSetting("localLoginEnabled"))) return NextResponse.json({ error: "Passkey sign-in is disabled." }, { status: 403 });
  const ip = requestIp(request);
  if (ip !== "unknown") {
    const rate = await checkRateLimit(`passkey:verify:${ip}`, 30, 15 * 60 * 1000);
    if (!rate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const challenge = decodePasskeyChallenge(request.cookies.get(PASSKEY_AUTHENTICATION_COOKIE)?.value, "authentication");
  if (!challenge) {
    // Limit invalid-request audit writes separately so they cannot lock out valid challenges.
    const invalidRate = await checkRateLimit(`passkey:invalid-challenge:${ip}`, 30, 60 * 1000);
    if (!invalidRate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    return authError("Passkey sign-in expired. Please try again.", request);
  }
  const attemptRate = await checkRateLimit(`passkey:attempt:${hashToken(challenge.challenge)}`, 30, PASSKEY_CHALLENGE_MAX_AGE_SECONDS * 1000);
  if (!attemptRate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const parsed = await readJsonBodyWithLimit(request, 64 * 1024);
  const body = (parsed.ok ? parsed.value : null) as AuthenticationPayload | null;
  if (!body?.response || typeof body.response.id !== "string" || !body.response.id || body.response.id.length > 1024) {
    return authError("Missing or invalid passkey authentication response.", request, parsed.ok || parsed.error !== "too_large" ? 400 : 413);
  }
  const release = takePasskeyVerificationSlot();
  if (!release) return NextResponse.json({ error: "Sign-in is busy. Please try again." }, { status: 429 });

  try {
    const passkey = await prisma.passkey.findUnique({
      where: { credentialId: body.response.id },
      include: { user: true }
    });
    if (!passkey) return await authError("That passkey is not registered for this site.", request, 401);
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: env.WEBAUTHN_ORIGIN,
      expectedRPID: env.WEBAUTHN_RP_ID,
      credential: passkeyToWebAuthnCredential(passkey),
      requireUserVerification: true
    });

    if (!verification.verified) return await authError("Could not verify that passkey.", request, 401);

    const challengeUse = await checkRateLimit(
      `passkey:authentication-challenge:${hashToken(challenge.challenge)}`,
      1,
      PASSKEY_CHALLENGE_MAX_AGE_SECONDS * 2 * 1000
    );
    if (!challengeUse.allowed) return await authError("Passkey sign-in expired. Please try again.", request, 401);

    await prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        backedUp: verification.authenticationInfo.credentialBackedUp,
        lastUsedAt: new Date()
      }
    });

    const { token, expiresAt } = await createSession(passkey.userId, request);
    await auditLog({
      userId: passkey.userId,
      action: AuditAction.LOGIN_SUCCESS,
      ipHash: requestIpHash(request),
      userAgent: request.headers.get("user-agent"),
      details: { passkey: true }
    });

    const response = NextResponse.json({ redirectTo: loginDestination(body.next) });
    response.cookies.set(PASSKEY_AUTHENTICATION_COOKIE, "", expiredPasskeyCookieOptions());
    setSessionCookie(response, token, expiresAt);
    return response;
  } catch {
    return await authError("Passkey sign-in failed.", request, 401);
  } finally {
    release();
  }
}
