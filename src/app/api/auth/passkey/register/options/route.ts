import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { validateCsrfValue } from "@/lib/csrf";
import { env } from "@/lib/env";
import { verifyProfileStepUp } from "@/lib/profile-step-up";
import { PROFILE_VERIFICATION_COOKIE, profileVerificationCookieOptions } from "@/lib/profile-verification";
import {
  cleanPasskeyName,
  encodePasskeyChallenge,
  PASSKEY_REGISTRATION_COOKIE,
  passkeyCookieOptions,
  parsePasskeyTransports
} from "@/lib/passkeys";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestIp, requestOriginMatchesApp } from "@/lib/request";
import { getSetting } from "@/lib/settings";

export async function POST(request: NextRequest) {
  if (!(await getSetting("localLoginEnabled"))) return NextResponse.json({ error: "Passkey registration is disabled." }, { status: 403 });
  const session = await getCurrentSession();
  const admin = session?.user;
  if (!session || !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requestOriginMatchesApp(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { csrf?: string; name?: string; method?: string; code?: string; password?: string } | null;
  try {
    validateCsrfValue(String(body?.csrf ?? ""));
  } catch {
    return NextResponse.json({ error: "The form expired. Please refresh and try again." }, { status: 400 });
  }

  const rate = await checkRateLimit(`passkey:registration:${requestIp(request)}:${admin.id}`, 8, 15 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many verification attempts. Please try again later." }, { status: 429 });

  const proof = await verifyProfileStepUp({ userId: admin.id, sessionId: session.id, sessionCreatedAt: session.createdAt,
    passwordHash: admin.passwordHash, action: "passkey-add", method: String(body?.method ?? "password"),
    code: body?.code, password: body?.password, proofCookie: request.cookies.get(PROFILE_VERIFICATION_COOKIE)?.value });
  if (proof.error) return NextResponse.json({ error: proof.error }, { status: 401 });

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
    encodePasskeyChallenge({ challenge: options.challenge, name, purpose: "registration", sessionId: session.id, userId: admin.id }),
    passkeyCookieOptions()
  );
  if (proof.usedProvider) response.cookies.set(PROFILE_VERIFICATION_COOKIE, "", { ...profileVerificationCookieOptions(), maxAge: 0 });
  return response;
}
