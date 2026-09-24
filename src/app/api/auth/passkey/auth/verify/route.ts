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
import { requestIp, requestIpHash } from "@/lib/request";
import { getSetting } from "@/lib/settings";

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
  const rate = await checkRateLimit(`passkey:verify:${ip}`, ip === "unknown" ? 3_000 : 30, 15 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const body = (await request.json().catch(() => null)) as AuthenticationPayload | null;
  if (!body?.response) return authError("Missing passkey authentication response.", request);

  const challenge = decodePasskeyChallenge(request.cookies.get(PASSKEY_AUTHENTICATION_COOKIE)?.value, "authentication");
  if (!challenge) return authError("Passkey sign-in expired. Please try again.", request);

  const passkey = await prisma.passkey.findUnique({
    where: { credentialId: body.response.id },
    include: { user: true }
  });
  if (!passkey) return authError("That passkey is not registered for this site.", request, 401);

  try {
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: env.WEBAUTHN_ORIGIN,
      expectedRPID: env.WEBAUTHN_RP_ID,
      credential: passkeyToWebAuthnCredential(passkey),
      requireUserVerification: true
    });

    if (!verification.verified) return authError("Could not verify that passkey.", request, 401);

    const challengeUse = await checkRateLimit(
      `passkey:authentication-challenge:${hashToken(challenge.challenge)}`,
      1,
      PASSKEY_CHALLENGE_MAX_AGE_SECONDS * 2 * 1000
    );
    if (!challengeUse.allowed) return authError("Passkey sign-in expired. Please try again.", request, 401);

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
    return authError("Passkey sign-in failed.", request, 401);
  }
}
