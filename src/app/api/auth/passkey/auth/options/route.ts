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
import { getSetting } from "@/lib/settings";

export async function POST(request: NextRequest) {
  if (!(await getSetting("localLoginEnabled"))) return NextResponse.json({ error: "Passkey sign-in is disabled." }, { status: 403 });
  const ip = requestIp(request);
  const rate = await checkRateLimit(`passkey:options:${ip}`, ip === "unknown" ? 3_000 : 30, 60 * 1000);
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
