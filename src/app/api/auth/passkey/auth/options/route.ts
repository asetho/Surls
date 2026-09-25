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
import { takePasskeyOptionsSlot } from "@/lib/passkey-auth-limits";

export async function POST(request: NextRequest) {
  if (!(await getSetting("localLoginEnabled"))) return NextResponse.json({ error: "Passkey sign-in is disabled." }, { status: 403 });
  const ip = requestIp(request);
  if (ip !== "unknown") {
    const rate = await checkRateLimit(`passkey:options:${ip}`, 30, 60 * 1000);
    if (!rate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  const release = takePasskeyOptionsSlot();
  if (!release) return NextResponse.json({ error: "Sign-in is busy. Please try again." }, { status: 429 });

  try {
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
  } finally {
    release();
  }
}
