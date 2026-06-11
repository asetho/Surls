import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import {
  encodePasskeyChallenge,
  PASSKEY_AUTHENTICATION_COOKIE,
  passkeyCookieOptions
} from "@/lib/passkeys";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestIp } from "@/lib/request";

export async function POST(request: NextRequest) {
  const rate = await checkRateLimit(`passkey:options:${requestIp(request)}`, 30, 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const options = await generateAuthenticationOptions({
    rpID: env.WEBAUTHN_RP_ID,
    userVerification: "required"
  });

  const response = NextResponse.json(options);
  response.cookies.set(
    PASSKEY_AUTHENTICATION_COOKIE,
    encodePasskeyChallenge({ challenge: options.challenge, purpose: "authentication" }),
    passkeyCookieOptions()
  );
  return response;
}
