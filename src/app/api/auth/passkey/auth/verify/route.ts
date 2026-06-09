import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { AuditAction } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { auditLog } from "@/lib/audit";
import { createSession, setSessionCookie } from "@/lib/auth";
import { appBaseUrl, env } from "@/lib/env";
import {
  decodePasskeyChallenge,
  expiredPasskeyCookieOptions,
  PASSKEY_AUTHENTICATION_COOKIE,
  passkeyToWebAuthnCredential
} from "@/lib/passkeys";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestIp, requestIpHash } from "@/lib/request";

async function readJson(request: NextRequest) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function safeNextPath(value: unknown) {
  const nextPath = String(value ?? "/admin");
  return nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/admin";
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`passkey-verify:${requestIp(request)}`, 20, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many passkey attempts. Please wait and try again." }, { status: 429 });
  }

  const body = await readJson(request);
  const credentialResponse = body.response as AuthenticationResponseJSON | undefined;
  const challenge = decodePasskeyChallenge(request.cookies.get(PASSKEY_AUTHENTICATION_COOKIE)?.value, "authentication");
  if (!challenge || !credentialResponse?.id) {
    return NextResponse.json({ error: "Passkey login expired. Please try again." }, { status: 400 });
  }

  const passkey = await prisma.passkey.findUnique({
    where: { credentialId: credentialResponse.id },
    include: { user: true }
  });

  if (!passkey) {
    await auditLog({
      action: AuditAction.LOGIN_FAILURE,
      ipHash: requestIpHash(request),
      userAgent: request.headers.get("user-agent"),
      details: { passkey: true, credentialId: credentialResponse.id }
    });
    return NextResponse.json({ error: "This passkey is not registered for this app." }, { status: 400 });
  }

  const verification = await verifyAuthenticationResponse({
    response: credentialResponse,
    expectedChallenge: challenge.challenge,
    expectedOrigin: env.WEBAUTHN_ORIGIN,
    expectedRPID: env.WEBAUTHN_RP_ID,
    credential: passkeyToWebAuthnCredential(passkey),
    requireUserVerification: true
  });

  if (!verification.verified) {
    await auditLog({
      userId: passkey.userId,
      action: AuditAction.LOGIN_FAILURE,
      ipHash: requestIpHash(request),
      userAgent: request.headers.get("user-agent"),
      details: { passkey: true }
    });
    return NextResponse.json({ error: "Could not verify that passkey." }, { status: 400 });
  }

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
    details: { passkey: true, passkeyId: passkey.id }
  });

  const redirectTo = new URL(safeNextPath(body.next), appBaseUrl()).toString();
  const response = NextResponse.json({ ok: true, redirectTo });
  setSessionCookie(response, token, expiresAt);
  response.cookies.set(PASSKEY_AUTHENTICATION_COOKIE, "", expiredPasskeyCookieOptions());
  return response;
}
