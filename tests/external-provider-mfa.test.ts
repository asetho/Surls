import { createHmac, generateKeyPairSync, sign } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { externalAuthorizationUrl, externalProfile } from "@/lib/external-auth";
import type { ExternalProviderConfig } from "@/lib/external-provider-settings";

const issuer = "https://id.example.test/realms/test";
const credentials: ExternalProviderConfig = {
  key: "oidc", provider: "oidc", id: "surls", secret: "test-client-secret", label: "Test",
  issuer, tenantId: null, logoDataUrl: null, source: "settings"
};
const pending = {
  provider: "oidc", state: "state", verifier: "test-pkce-verifier", nonce: "nonce",
  nextPath: "/admin", userId: null, issuedAt: Date.now()
};
const callback = new URL("http://localhost:3000/api/auth/external/oidc/callback?code=code&state=state");
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

function mockOidc(claims: Record<string, unknown> = {}, options: {
  alg?: "RS256" | "HS256" | "none"; userInfo?: Record<string, unknown>
} = {}) {
  const alg = options.alg ?? "RS256";
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuer, aud: credentials.id, sub: "subject", iat: now, exp: now + 300,
    nonce: pending.nonce, email: "user@example.com", email_verified: true, ...claims
  };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const input = `${encode({ alg, typ: "JWT" })}.${encode(payload)}`;
  const signature = alg === "RS256" ? sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url") :
    alg === "HS256" ? createHmac("sha256", credentials.secret).update(input).digest("base64url") : "";
  vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
    switch (String(url)) {
      case `${issuer}/.well-known/openid-configuration`:
        return Response.json({
          issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`,
          userinfo_endpoint: `${issuer}/userinfo`, response_types_supported: ["code"],
          subject_types_supported: ["public"], id_token_signing_alg_values_supported: [alg],
          token_endpoint_auth_methods_supported: ["client_secret_post"]
        });
      case `${issuer}/token`:
        return Response.json({ access_token: "access-token", token_type: "Bearer", id_token: `${input}.${signature}` });
      case `${issuer}/userinfo`:
        return Response.json({ sub: "subject", ...options.userInfo });
      default:
        throw new Error(`Unexpected test request: ${url}`);
    }
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe("provider MFA evidence through the real OIDC code exchange", () => {
  it.each([["mfa"], ["pwd", "otp"], ["otp", "pwd"]])("accepts completed MFA methods %j", async (...amr) => {
    mockOidc({ amr });
    expect((await externalProfile("oidc", callback, pending, credentials)).mfaVerified).toBe(true);
  });

  it.each([
    { amr: undefined }, { amr: [] }, { amr: "mfa" }, { amr: { mfa: true } },
    { amr: ["MFA"] }, { amr: ["mfa", true] }, { amr: ["pwd"] }, { amr: ["otp"] },
    { amr: ["pwd", "pin"] }, { amr: ["pwd", "pwd"] }, { amr: ["hwk"] },
    { amr: ["swk", "user"] }, { amr: ["webauthn"] }, { acr: "2" }, { acr: "mfa" }
  ])("does not infer MFA from insufficient or malformed claims %j", async (claims) => {
    mockOidc(claims);
    expect((await externalProfile("oidc", callback, pending, credentials)).mfaVerified).toBe(false);
  });

  it("accepts a user-verified passkey reported as MFA in an existing SSO session", async () => {
    mockOidc({ amr: ["mfa", "swk"], auth_time: Math.floor(Date.now() / 1000) - 3600 });
    expect((await externalProfile("oidc", callback, pending, credentials)).mfaVerified).toBe(true);
    const url = await externalAuthorizationUrl("oidc", pending.state, pending.verifier, pending.nonce, credentials);
    expect(url.searchParams.get("prompt")).toBeNull();
    expect(url.searchParams.get("max_age")).toBeNull();
    expect(url.searchParams.get("nonce")).toBe(pending.nonce);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("requests and reads fresh authentication time for profile verification", async () => {
    const now = Math.floor(Date.now() / 1000);
    mockOidc({ auth_time: now });
    const url = await externalAuthorizationUrl("oidc", pending.state, pending.verifier, pending.nonce, credentials, true);
    expect(url.searchParams.get("max_age")).toBe("0");
    expect((await externalProfile("oidc", callback, pending, credentials)).authenticatedAt).toBe(now);
  });

  it("does not trust MFA in UserInfo or callback parameters", async () => {
    mockOidc({ email_verified: false }, { userInfo: {
      amr: ["mfa"], mfa_enabled: true, email: "verified@example.com", email_verified: true
    } });
    const tampered = new URL(callback);
    tampered.searchParams.set("amr", "mfa");
    tampered.searchParams.set("mfaVerified", "true");
    expect(await externalProfile("oidc", tampered, pending, credentials)).toMatchObject({
      email: "verified@example.com", emailVerified: true, mfaVerified: false
    });
  });

  it.each([
    { nonce: "wrong" }, { iss: "https://other.example.test" }, { aud: "other-client" },
    { exp: 1 }, { sub: "" }
  ])("rejects MFA claims when ID-token validation fails: %j", async (claims) => {
    mockOidc({ amr: ["mfa"], ...claims });
    await expect(externalProfile("oidc", callback, pending, credentials)).rejects.toThrow();
  });

  it.each(["HS256", "none"] as const)("preserves the supported %s token response over the authenticated HTTPS backchannel", async (alg) => {
    mockOidc({ amr: ["pwd", "otp"] }, { alg });
    expect((await externalProfile("oidc", callback, pending, credentials)).mfaVerified).toBe(true);
  });

  it("does not treat OAuth account enrollment as proof of completed MFA", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
      if (String(url) === "https://discord.com/api/oauth2/token") return Response.json({ access_token: "token" });
      if (String(url) === "https://discord.com/api/users/@me") return Response.json({
        id: "subject", email: "user@example.com", verified: true, mfa_enabled: true, amr: ["mfa"]
      });
      throw new Error(`Unexpected test request: ${url}`);
    }));
    expect(await externalProfile("discord", callback, pending, { ...credentials, provider: "discord", key: "discord" }))
      .toMatchObject({ emailVerified: true, mfaVerified: false });
  });
});
