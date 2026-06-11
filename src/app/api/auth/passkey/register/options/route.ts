import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { validateCsrfValue } from "@/lib/csrf";
import { env } from "@/lib/env";
import {
  cleanPasskeyName,
  encodePasskeyChallenge,
  PASSKEY_REGISTRATION_COOKIE,
  passkeyCookieOptions,
  parsePasskeyTransports
} from "@/lib/passkeys";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { csrf?: string; name?: string } | null;
  try {
    validateCsrfValue(String(body?.csrf ?? ""));
  } catch {
    return NextResponse.json({ error: "The form expired. Please refresh and try again." }, { status: 400 });
  }

  const name = cleanPasskeyName(body?.name);
  const existingPasskeys = await prisma.passkey.findMany({
    where: { userId: admin.id },
    select: { credentialId: true, transports: true }
  });
  const options = await generateRegistrationOptions({
    rpName: env.APP_NAME,
    rpID: env.WEBAUTHN_RP_ID,
    userID: Buffer.from(admin.id, "utf8"),
    userName: admin.email,
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
    encodePasskeyChallenge({ challenge: options.challenge, name, purpose: "registration", userId: admin.id }),
    passkeyCookieOptions()
  );
  return response;
}
