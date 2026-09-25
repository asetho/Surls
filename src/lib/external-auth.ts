import { createHmac } from "node:crypto";
import * as oidc from "openid-client";
import { isProduction } from "./env";
import { randomToken, signValue, verifySignedValue } from "./crypto";
import {
  externalCallbackUrl, externalProviderType, type ExternalProvider, type ExternalProviderConfig
} from "./external-provider-settings";
import { safeRedirectPath } from "./redirect-path";

export { externalCallbackUrl, isExternalProvider } from "./external-provider-settings";
export type { ExternalProvider } from "./external-provider-settings";

export const EXTERNAL_AUTH_COOKIE = "surls_external_auth";
const MAX_AGE_SECONDS = 10 * 60;
type PendingExternalAuth = {
  provider: string;
  state: string;
  verifier: string;
  nonce: string;
  nextPath: string;
  userId: string | null;
  issuedAt: number;
};

export function externalAuthCookieOptions() {
  return { httpOnly: true, secure: isProduction(), sameSite: "lax" as const, path: "/api/auth/external", maxAge: MAX_AGE_SECONDS };
}

export function expiredExternalAuthCookieOptions() {
  return { ...externalAuthCookieOptions(), maxAge: 0, expires: new Date(0) };
}

export function encodeExternalAuth(payload: Omit<PendingExternalAuth, "issuedAt" | "nextPath"> & { nextPath: unknown }) {
  const encoded = Buffer.from(JSON.stringify({ ...payload, nextPath: safeRedirectPath(payload.nextPath), issuedAt: Date.now() })).toString("base64url");
  return signValue(encoded);
}

export function decodeExternalAuth(value: string | undefined): PendingExternalAuth | null {
  const encoded = value && verifySignedValue(value);
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as PendingExternalAuth;
    if (!externalProviderType(parsed.provider) || typeof parsed.state !== "string" || parsed.state.length < 30 ||
        typeof parsed.verifier !== "string" || parsed.verifier.length < 30 || typeof parsed.nonce !== "string" ||
        parsed.nonce.length < 30 || (parsed.userId !== null && typeof parsed.userId !== "string") ||
        !Number.isSafeInteger(parsed.issuedAt) || parsed.issuedAt > Date.now() + 30_000 ||
        Date.now() - parsed.issuedAt > MAX_AGE_SECONDS * 1000) return null;
    return { ...parsed, nextPath: safeRedirectPath(parsed.nextPath) };
  } catch {
    return null;
  }
}

function oidcIssuer(provider: "oidc" | "google" | "microsoft", credentials: ExternalProviderConfig) {
  if (provider === "google") return "https://accounts.google.com";
  if (provider === "microsoft") return `https://login.microsoftonline.com/${credentials.tenantId}/v2.0`;
  return credentials.issuer!;
}

function basicClientAuthorization(clientId: string, clientSecret: string) {
  const formEncode = (value: string) => new URLSearchParams({ value }).toString().slice("value=".length);
  return `Basic ${Buffer.from(`${formEncode(clientId)}:${formEncode(clientSecret)}`).toString("base64")}`;
}

async function oidcConfiguration(provider: "oidc" | "google" | "microsoft", credentials: ExternalProviderConfig) {
  return oidc.discovery(new URL(oidcIssuer(provider, credentials)), credentials.id, { client_secret: credentials.secret }, oidc.ClientSecretPost(credentials.secret));
}

export type ExternalIdentityProfile = {
  subject: string; email: string | null; emailVerified: boolean; name: string | null; mfaVerified: boolean
};

function confirmsMfa(amr: unknown): boolean {
  if (!Array.isArray(amr) || !amr.every((method) => typeof method === "string")) return false;
  // RFC 8176 methods are case-sensitive. An arbitrary ACR level or passkey
  // possession alone does not establish that multiple factors were verified.
  return amr.includes("mfa") || (amr.includes("pwd") && amr.includes("otp"));
}

export async function externalAuthorizationUrl(provider: ExternalProvider, state: string, verifier: string, nonce: string, credentials: ExternalProviderConfig) {
  const challenge = await oidc.calculatePKCECodeChallenge(verifier);
  const callback = externalCallbackUrl(credentials.key);
  if (provider === "oidc" || provider === "google" || provider === "microsoft") {
    const configuration = await oidcConfiguration(provider, credentials);
    return oidc.buildAuthorizationUrl(configuration, {
      response_type: "code", client_id: credentials.id, redirect_uri: callback,
      scope: "openid email profile", state, nonce, code_challenge: challenge, code_challenge_method: "S256"
    });
  }
  if (provider === "facebook") {
    const url = new URL("https://www.facebook.com/dialog/oauth");
    url.search = new URLSearchParams({ client_id: credentials.id, redirect_uri: callback, response_type: "code", scope: "email", state }).toString();
    return url;
  }
  if (provider === "github" || provider === "discord") {
    const url = new URL(provider === "github" ? "https://github.com/login/oauth/authorize" : "https://discord.com/oauth2/authorize");
    url.search = new URLSearchParams({ client_id: credentials.id, redirect_uri: callback, response_type: "code",
      scope: provider === "github" ? "read:user user:email" : "identify email", state,
      code_challenge: challenge, code_challenge_method: "S256" }).toString();
    return url;
  }
  const url = new URL("https://x.com/i/oauth2/authorize");
  url.search = new URLSearchParams({ response_type: "code", client_id: credentials.id, redirect_uri: callback,
    scope: "users.read", state, code_challenge: challenge, code_challenge_method: "S256" }).toString();
  return url;
}

async function jsonResponse(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new Error("The provider rejected sign-in.");
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("The provider returned an invalid response.");
  return body as Record<string, unknown>;
}

export async function externalProfile(provider: ExternalProvider, callback: URL, pending: PendingExternalAuth, credentials: ExternalProviderConfig): Promise<ExternalIdentityProfile> {
  if (provider === "oidc" || provider === "google" || provider === "microsoft") {
    const configuration = await oidcConfiguration(provider, credentials);
    const tokens = await oidc.authorizationCodeGrant(configuration, callback, {
      pkceCodeVerifier: pending.verifier, expectedState: pending.state, expectedNonce: pending.nonce, idTokenExpected: true
    });
    const claims = tokens.claims();
    if (!claims || typeof claims.sub !== "string" || !claims.sub) throw new Error("The provider did not return an identity.");
    let userInfo: Awaited<ReturnType<typeof oidc.fetchUserInfo>> | null = null;
    if (!(claims.email_verified === true && typeof claims.email === "string") && tokens.access_token) {
      userInfo = await oidc.fetchUserInfo(configuration, tokens.access_token, claims.sub).catch(() => null);
    }
    const verifiedEmail = claims.email_verified === true && typeof claims.email === "string"
      ? claims.email
      : userInfo?.email_verified === true && typeof userInfo.email === "string" ? userInfo.email : null;
    return {
      subject: claims.sub,
      email: verifiedEmail,
      emailVerified: Boolean(verifiedEmail),
      // Only use the ID token validated by the nonce-bound HTTPS code exchange.
      // UserInfo, account enrollment, and callback parameters are not MFA proof.
      mfaVerified: confirmsMfa(claims.amr),
      name: typeof claims.name === "string" ? claims.name : typeof userInfo?.name === "string" ? userInfo.name : null
    };
  }
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("The provider did not return an authorization code.");
  if (provider === "facebook") {
    const token = await jsonResponse(await fetch("https://graph.facebook.com/oauth/access_token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: credentials.id, client_secret: credentials.secret,
        redirect_uri: externalCallbackUrl(credentials.key), code }), cache: "no-store"
    }));
    if (typeof token.access_token !== "string") throw new Error("Facebook did not return an access token.");
    const proof = createHmac("sha256", credentials.secret).update(token.access_token).digest("hex");
    const url = new URL("https://graph.facebook.com/me");
    url.searchParams.set("fields", "id,name,email");
    url.searchParams.set("appsecret_proof", proof);
    const profile = await jsonResponse(await fetch(url, { headers: { authorization: `Bearer ${token.access_token}` }, cache: "no-store" }));
    if (typeof profile.id !== "string" || !profile.id) throw new Error("Facebook did not return an identity.");
    return { subject: profile.id, email: typeof profile.email === "string" ? profile.email : null,
      emailVerified: false, mfaVerified: false, name: typeof profile.name === "string" ? profile.name : null };
  }
  if (provider === "github" || provider === "discord") {
    const token = await jsonResponse(await fetch(provider === "github" ? "https://github.com/login/oauth/access_token" : "https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ client_id: credentials.id, client_secret: credentials.secret,
        code, redirect_uri: externalCallbackUrl(credentials.key), grant_type: "authorization_code", code_verifier: pending.verifier }),
      cache: "no-store"
    }));
    if (typeof token.access_token !== "string") throw new Error("The provider did not return an access token.");
    const headers = { authorization: `Bearer ${token.access_token}`, accept: "application/json", "user-agent": "Surls" };
    const user = await jsonResponse(await fetch(provider === "github" ? "https://api.github.com/user" : "https://discord.com/api/users/@me", { headers, cache: "no-store" }));
    if (provider === "discord") {
      if (typeof user.id !== "string" || !user.id) throw new Error("Discord did not return an identity.");
      return { subject: user.id, email: typeof user.email === "string" ? user.email : null,
        emailVerified: user.verified === true, mfaVerified: false, name: typeof user.global_name === "string" ? user.global_name : null };
    }
    if (typeof user.id !== "number" || !Number.isSafeInteger(user.id)) throw new Error("GitHub did not return an identity.");
    const emailsResponse = await fetch("https://api.github.com/user/emails", { headers, cache: "no-store" });
    const emails: unknown = emailsResponse.ok ? await emailsResponse.json() : [];
    const primary = Array.isArray(emails) ? emails.find((item) => item && typeof item === "object" && item.primary === true && item.verified === true) : null;
    return { subject: String(user.id), email: primary && typeof primary.email === "string" ? primary.email : null,
      emailVerified: Boolean(primary), mfaVerified: false, name: typeof user.name === "string" ? user.name : null };
  }
  const token = await jsonResponse(await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: basicClientAuthorization(credentials.id, credentials.secret) },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: externalCallbackUrl(credentials.key), code_verifier: pending.verifier }),
    cache: "no-store"
  }));
  if (typeof token.access_token !== "string") throw new Error("X did not return an access token.");
  const profile = await jsonResponse(await fetch("https://api.x.com/2/users/me", {
    headers: { authorization: `Bearer ${token.access_token}` }, cache: "no-store"
  }));
  const data = profile.data;
  if (!data || typeof data !== "object" || Array.isArray(data) || typeof (data as Record<string, unknown>).id !== "string") {
    throw new Error("X did not return an identity.");
  }
  const user = data as Record<string, unknown>;
  return { subject: user.id as string, email: null, emailVerified: false, mfaVerified: false,
    name: typeof user.name === "string" ? user.name : null };
}

export function newExternalAuthValues() {
  return { state: randomToken(), verifier: oidc.randomPKCECodeVerifier(), nonce: oidc.randomNonce() };
}
