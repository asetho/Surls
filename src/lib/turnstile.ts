import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { requestIp } from "@/lib/request";
import { TURNSTILE_RESPONSE_FIELD } from "@/lib/turnstile-shared";

type TurnstileSiteVerifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

export type TurnstileVerification =
  | { ok: true; skipped: boolean }
  | { ok: false; reason: "failed" | "missing" | "unavailable" };

export function isTurnstileEnabled() {
  return Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);
}

export function turnstileSiteKey() {
  return isTurnstileEnabled() ? env.TURNSTILE_SITE_KEY : undefined;
}

export async function verifyTurnstileChallenge(formData: FormData, request: NextRequest): Promise<TurnstileVerification> {
  if (!isTurnstileEnabled()) return { ok: true, skipped: true };

  const token = String(formData.get(TURNSTILE_RESPONSE_FIELD) ?? "").trim();
  if (!token) return { ok: false, reason: "missing" };

  const body = new URLSearchParams();
  body.set("secret", env.TURNSTILE_SECRET_KEY ?? "");
  body.set("response", token);

  const ip = requestIp(request);
  if (ip !== "unknown") body.set("remoteip", ip);

  let response: Response;
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      body,
      cache: "no-store",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST"
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!response.ok) return { ok: false, reason: "unavailable" };

  const result = (await response.json()) as TurnstileSiteVerifyResponse;
  return result.success ? { ok: true, skipped: false } : { ok: false, reason: "failed" };
}
