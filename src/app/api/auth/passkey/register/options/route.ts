import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { validateCsrfValue } from "@/lib/csrf";
import { env } from "@/lib/env";
import {
  cleanPasskeyName,
  encodePasskeyChallenge,
  passkeyCookieOptions,
  PASSKEY_REGISTRATION_COOKIE,
  parsePasskeyTransports
} from "@/lib/passkeys";
import { prisma } from "@/lib/prisma";
import { getSiteName } from "@/lib/settings";

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

  const [siteName, existingPasskeys] = await Promise.all([
    getSiteName(),
    prisma.passkey.findMany({ where: { userId: admin.id }, select: { credentialId: true, transports: true } })
  ]);

  const options = await generateRegistrationOptions({
    rpName: siteName,
    rpID: env.WEBAUTHN_RP_ID,
    userName: admin.email,
    userID: new TextEncoder().encode(admin.id),
    userDisplayName: admin.name || admin.email,
    attestationType: "none",
    excludeCredentials: existingPasskeys.map((passkey) => ({
      id: passkey.credentialId,
      transports: parsePasskeyTransports(passkey.transports)
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required"
    }
  });

  const response = NextResponse.json(options);
  response.cookies.set(
    PASSKEY_REGISTRATION_COOKIE,
    encodePasskeyChallenge({
      challenge: options.challenge,
      name: cleanPasskeyName(body.name),
      purpose: "registration",
      userId: admin.id
    }),
    passkeyCookieOptions()
  );
  return response;
}
