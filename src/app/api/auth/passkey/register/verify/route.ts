import { AuditAction, Prisma } from "@prisma/client";
import { verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { NextResponse, type NextRequest } from "next/server";
import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { validateCsrfValue } from "@/lib/csrf";
import { env } from "@/lib/env";
import {
  cleanPasskeyName,
  decodePasskeyChallenge,
  expiredPasskeyCookieOptions,
  PASSKEY_REGISTRATION_COOKIE,
  uint8ArrayToBase64Url
} from "@/lib/passkeys";
import { prisma } from "@/lib/prisma";

type RegistrationPayload = {
  csrf?: string;
  name?: string;
  response?: RegistrationResponseJSON;
};

function registrationError(message: string, status = 400) {
  const response = NextResponse.json({ error: message }, { status });
  response.cookies.set(PASSKEY_REGISTRATION_COOKIE, "", expiredPasskeyCookieOptions());
  return response;
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return registrationError("Unauthorized", 401);

  const body = (await request.json().catch(() => null)) as RegistrationPayload | null;
  try {
    validateCsrfValue(String(body?.csrf ?? ""));
  } catch {
    return registrationError("The form expired. Please refresh and try again.");
  }

  if (!body?.response) return registrationError("Missing passkey registration response.");

  const challenge = decodePasskeyChallenge(request.cookies.get(PASSKEY_REGISTRATION_COOKIE)?.value, "registration");
  if (!challenge || challenge.userId !== admin.id) {
    return registrationError("Passkey setup expired. Please try again.");
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: env.WEBAUTHN_ORIGIN,
      expectedRPID: env.WEBAUTHN_RP_ID,
      requireUserVerification: true
    });

    if (!verification.verified) return registrationError("Could not verify that passkey.");

    const { credential, credentialBackedUp } = verification.registrationInfo;
    const passkey = await prisma.passkey.create({
      data: {
        userId: admin.id,
        name: cleanPasskeyName(body.name ?? challenge.name),
        credentialId: credential.id,
        publicKey: uint8ArrayToBase64Url(credential.publicKey),
        counter: BigInt(credential.counter),
        transports: body.response.response.transports ? JSON.stringify(body.response.response.transports) : null,
        backedUp: credentialBackedUp
      }
    });

    await auditLog({
      userId: admin.id,
      action: AuditAction.PASSKEY_ADDED,
      entityType: "Passkey",
      entityId: passkey.id,
      details: { name: passkey.name }
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(PASSKEY_REGISTRATION_COOKIE, "", expiredPasskeyCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return registrationError("That passkey is already registered.");
    }
    return registrationError("Passkey setup failed.");
  }
}
