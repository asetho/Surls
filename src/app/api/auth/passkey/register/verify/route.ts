import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
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

async function readJson(request: NextRequest) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson(request);
  try {
    validateCsrfValue(String(body.csrf ?? ""));
  } catch {
    return NextResponse.json({ error: "The form expired. Please refresh and try again." }, { status: 400 });
  }

  const challenge = decodePasskeyChallenge(request.cookies.get(PASSKEY_REGISTRATION_COOKIE)?.value, "registration");
  if (!challenge || challenge.userId !== admin.id) {
    return NextResponse.json({ error: "Passkey setup expired. Please try again." }, { status: 400 });
  }

  const verification = await verifyRegistrationResponse({
    response: body.response as RegistrationResponseJSON,
    expectedChallenge: challenge.challenge,
    expectedOrigin: env.WEBAUTHN_ORIGIN,
    expectedRPID: env.WEBAUTHN_RP_ID,
    requireUserVerification: true
  });

  if (!verification.verified) {
    return NextResponse.json({ error: "Could not verify that passkey." }, { status: 400 });
  }

  const { credential, credentialBackedUp } = verification.registrationInfo;
  const transports = (body.response as RegistrationResponseJSON | undefined)?.response?.transports ?? [];
  const passkey = await prisma.passkey.create({
    data: {
      userId: admin.id,
      name: cleanPasskeyName(body.name ?? challenge.name),
      credentialId: credential.id,
      publicKey: uint8ArrayToBase64Url(credential.publicKey),
      counter: BigInt(credential.counter),
      transports: JSON.stringify(transports),
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
  revalidatePath("/admin/profile");

  const response = NextResponse.json({ ok: true });
  response.cookies.set(PASSKEY_REGISTRATION_COOKIE, "", expiredPasskeyCookieOptions());
  return response;
}
