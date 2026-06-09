import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse, type NextRequest } from "next/server";
import { appBaseUrl, env } from "@/lib/env";
import { encodePasskeyChallenge, passkeyCookieOptions, PASSKEY_AUTHENTICATION_COOKIE } from "@/lib/passkeys";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestIp } from "@/lib/request";

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`passkey-options:${requestIp(request)}`, 20, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many passkey attempts. Please wait and try again." }, { status: 429 });
  }

  const passkeyCount = await prisma.passkey.count();
  if (!passkeyCount) {
    return NextResponse.json({ error: "No passkeys have been registered yet." }, { status: 400 });
  }

  const options = await generateAuthenticationOptions({
    rpID: env.WEBAUTHN_RP_ID,
    userVerification: "required"
  });

  const response = NextResponse.json({ ...options, origin: appBaseUrl() });
  response.cookies.set(
    PASSKEY_AUTHENTICATION_COOKIE,
    encodePasskeyChallenge({ challenge: options.challenge, purpose: "authentication" }),
    passkeyCookieOptions()
  );
  return response;
}
