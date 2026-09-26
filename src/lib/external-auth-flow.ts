import { NextResponse } from "next/server";
import { encodeExternalAuth, EXTERNAL_AUTH_COOKIE, externalAuthCookieOptions, externalAuthorizationUrl, newExternalAuthValues } from "./external-auth";
import type { ExternalProviderConfig } from "./external-provider-settings";

type StartOptions =
  | { userId: null; nextPath: unknown }
  | { userId: string; sessionId: string; purpose: "connect"; nextPath: unknown }
  | { userId: string; sessionId: string; purpose: "reauth"; pendingEmail?: string; nextPath: unknown }
  | { userId: string; sessionId: string; purpose: "verify-connect"; targetProvider: string; nextPath: unknown }
  | { userId: string; sessionId: string; purpose: "verify-totp-setup"; nextPath: unknown };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]!);
}

function linkAuthorizationPage(authorizationUrl: URL) {
  if (authorizationUrl.protocol !== "https:" && authorizationUrl.protocol !== "http:") {
    throw new Error("Unsupported authorization URL protocol.");
  }
  const url = escapeHtml(authorizationUrl.toString());
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${url}"><title>Connecting to sign-in provider</title></head><body><p>Connecting to sign-in provider…</p><p><a href="${url}">Continue</a></p></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
      }
    }
  );
}

export async function beginExternalAuth(config: ExternalProviderConfig, options: StartOptions) {
  const values = newExternalAuthValues();
  const reauthenticate = options.userId !== null && (options.purpose === "reauth" || options.purpose === "verify-connect" || options.purpose === "verify-totp-setup");
  const authorizationUrl = await externalAuthorizationUrl(config.provider, values.state, values.verifier, values.nonce, config, reauthenticate);
  const response = options.userId === null ? NextResponse.redirect(authorizationUrl, 303) : linkAuthorizationPage(authorizationUrl);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(EXTERNAL_AUTH_COOKIE, encodeExternalAuth({ provider: config.key, ...values, ...options }), externalAuthCookieOptions());
  return response;
}
