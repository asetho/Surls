import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ externalProviderSetting: {
  findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn()
} }));
const providerEnvironment = vi.hoisted(() => ({
  AUTH_SECRET: "provider-settings-tests-have-a-stable-secret-12345",
  GOOGLE_CLIENT_ID: "environment-client",
  GOOGLE_CLIENT_SECRET: "environment-secret",
  OIDC_PROVIDER_NAME: "Single sign-on",
  OIDC_ISSUER: undefined as string | undefined,
  OIDC_CLIENT_ID: undefined as string | undefined,
  OIDC_CLIENT_SECRET: undefined as string | undefined,
  MICROSOFT_TENANT_ID: undefined as string | undefined,
  MICROSOFT_CLIENT_ID: undefined as string | undefined,
  MICROSOFT_CLIENT_SECRET: undefined as string | undefined
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/env", () => ({
  appBaseUrl: () => "https://links.example.com",
  env: providerEnvironment
}));

import { decryptSecret } from "@/lib/crypto";
import {
  disableExternalProviderSetting, externalProviderKey, externalProviderType, getExternalProviderConfig, getExternalProviderSummaries,
  getConfiguredExternalProviders, removeExternalProviderSetting, saveExternalProviderSetting
} from "@/lib/external-provider-settings";
import { providerProfileKey } from "@/lib/provider-profile-key";
import { externalAuthorizationUrl } from "@/lib/external-auth";

const googleValues = { clientId: "saved-client", clientSecret: "saved-secret", label: "", issuer: "", tenantId: "" };
const oidcValues = { ...googleValues, label: "Hosted sign-in", issuer: "https://auth.example.com/realms/example" };

describe("external provider settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerEnvironment.OIDC_ISSUER = undefined;
    providerEnvironment.OIDC_CLIENT_ID = undefined;
    providerEnvironment.OIDC_CLIENT_SECRET = undefined;
    providerEnvironment.MICROSOFT_TENANT_ID = undefined;
    providerEnvironment.MICROSOFT_CLIENT_ID = undefined;
    providerEnvironment.MICROSOFT_CLIENT_SECRET = undefined;
    prisma.externalProviderSetting.findUnique.mockResolvedValue(null);
    prisma.externalProviderSetting.findMany.mockResolvedValue([]);
  });

  it("uses environment credentials until a database setting overrides them", async () => {
    await expect(getExternalProviderConfig("google")).resolves.toMatchObject({ id: "environment-client", secret: "environment-secret", source: "environment" });
    const summaries = await getExternalProviderSummaries();
    expect(summaries.find((provider) => provider.provider === "google")).toMatchObject({ enabled: true, source: "environment", hasSecret: true });
    expect(JSON.stringify(summaries)).not.toContain("environment-secret");
  });

  it("encrypts a saved client secret and preserves it when the edit field is blank", async () => {
    await saveExternalProviderSetting("google", googleValues);
    const first = prisma.externalProviderSetting.upsert.mock.calls[0][0].create;
    expect(first.secretEncrypted).not.toContain("saved-secret");
    expect(decryptSecret(first.secretEncrypted)).toBe("saved-secret");

    prisma.externalProviderSetting.findUnique.mockResolvedValue(first);
    await saveExternalProviderSetting("google", { ...googleValues, clientSecret: "" });
    expect(prisma.externalProviderSetting.upsert.mock.calls[1][0].update).toMatchObject({ clientId: "saved-client", secretEncrypted: first.secretEncrypted });
  });

  it("requires a new secret when a saved or environment client ID changes", async () => {
    await expect(saveExternalProviderSetting("google", { ...googleValues, clientId: "new-client", clientSecret: "" }))
      .rejects.toThrow("new client secret when changing the client ID");
    expect(prisma.externalProviderSetting.upsert).not.toHaveBeenCalled();

    await saveExternalProviderSetting("google", googleValues);
    const saved = prisma.externalProviderSetting.upsert.mock.calls[0][0].create;
    prisma.externalProviderSetting.findUnique.mockResolvedValue(saved);
    await expect(saveExternalProviderSetting("google", { ...googleValues, clientId: "new-client", clientSecret: "" }))
      .rejects.toThrow("new client secret when changing the client ID");
    expect(prisma.externalProviderSetting.upsert).toHaveBeenCalledTimes(1);

    await saveExternalProviderSetting("google", { ...googleValues, clientId: "new-client", clientSecret: "replacement-secret" });
    const updated = prisma.externalProviderSetting.upsert.mock.calls[1][0].update;
    expect(updated.clientId).toBe("new-client");
    expect(decryptSecret(updated.secretEncrypted)).toBe("replacement-secret");
  });

  it("requires a new secret when a saved OIDC issuer changes", async () => {
    await saveExternalProviderSetting("oidc", oidcValues);
    const saved = prisma.externalProviderSetting.upsert.mock.calls[0][0].create;
    prisma.externalProviderSetting.findUnique.mockResolvedValue(saved);

    const changed = { ...oidcValues, issuer: "https://other.example.com/realms/example", clientSecret: "" };
    await expect(saveExternalProviderSetting("oidc", changed)).rejects.toThrow("new client secret when changing the issuer URL");
    expect(prisma.externalProviderSetting.upsert).toHaveBeenCalledTimes(1);

    await saveExternalProviderSetting("oidc", { ...changed, clientSecret: "replacement-secret" });
    const updated = prisma.externalProviderSetting.upsert.mock.calls[1][0].update;
    expect(updated.issuer).toBe(changed.issuer);
    expect(decryptSecret(updated.secretEncrypted)).toBe("replacement-secret");
  });

  it("requires a new secret when changing an environment OIDC issuer", async () => {
    providerEnvironment.OIDC_ISSUER = oidcValues.issuer;
    providerEnvironment.OIDC_CLIENT_ID = "environment-oidc-client";
    providerEnvironment.OIDC_CLIENT_SECRET = "environment-oidc-secret";
    const values = { ...oidcValues, clientId: "environment-oidc-client", clientSecret: "" };

    await expect(saveExternalProviderSetting("oidc", { ...values, issuer: "https://other.example.com/realms/example" }))
      .rejects.toThrow("new client secret when changing the issuer URL");
    expect(prisma.externalProviderSetting.upsert).not.toHaveBeenCalled();

    await saveExternalProviderSetting("oidc", values);
    expect(decryptSecret(prisma.externalProviderSetting.upsert.mock.calls[0][0].create.secretEncrypted)).toBe("environment-oidc-secret");
  });

  it("requires a new secret when a Microsoft tenant changes", async () => {
    providerEnvironment.MICROSOFT_TENANT_ID = "original.example.com";
    providerEnvironment.MICROSOFT_CLIENT_ID = "microsoft-client";
    providerEnvironment.MICROSOFT_CLIENT_SECRET = "environment-microsoft-secret";
    const values = { ...googleValues, clientId: "microsoft-client", clientSecret: "", tenantId: "original.example.com" };
    const changed = { ...values, tenantId: "new.example.com" };

    await expect(saveExternalProviderSetting("microsoft", changed)).rejects.toThrow("new client secret when changing the Microsoft tenant");
    await saveExternalProviderSetting("microsoft", values);
    const saved = prisma.externalProviderSetting.upsert.mock.calls[0][0].create;
    expect(decryptSecret(saved.secretEncrypted)).toBe("environment-microsoft-secret");
    prisma.externalProviderSetting.findUnique.mockResolvedValue(saved);

    await expect(saveExternalProviderSetting("microsoft", changed)).rejects.toThrow("new client secret when changing the Microsoft tenant");
    expect(prisma.externalProviderSetting.upsert).toHaveBeenCalledTimes(1);
    await saveExternalProviderSetting("microsoft", { ...changed, clientSecret: "replacement-secret" });
    const updated = prisma.externalProviderSetting.upsert.mock.calls[1][0].update;
    expect(updated.tenantId).toBe(changed.tenantId);
    expect(decryptSecret(updated.secretEncrypted)).toBe("replacement-secret");
  });

  it("stores separate profiles of the same type with their own callbacks and default logos", async () => {
    const firstKey = "oidc--11111111-1111-4111-8111-111111111111";
    const secondKey = "oidc--22222222-2222-4222-8222-222222222222";
    const values = { clientId: "client", clientSecret: "secret", issuer: "https://auth.example.com/realms/one", tenantId: "", label: "First" };
    await saveExternalProviderSetting("oidc", { ...values, key: firstKey });
    await saveExternalProviderSetting("oidc", { ...values, key: secondKey, label: "Second" });
    const first = prisma.externalProviderSetting.upsert.mock.calls[0][0].create;
    const second = prisma.externalProviderSetting.upsert.mock.calls[1][0].create;
    expect(first).toMatchObject({ provider: firstKey, label: "First", logoDataUrl: null });
    expect(second).toMatchObject({ provider: secondKey, label: "Second", logoDataUrl: null });
    prisma.externalProviderSetting.findMany.mockResolvedValue([first, second]);
    prisma.externalProviderSetting.findUnique.mockImplementation(({ where }: { where: { provider: string } }) =>
      [first, second].find((row) => row.provider === where.provider) ?? null);
    const configs = await getConfiguredExternalProviders();
    expect(configs.filter((config) => config.provider === "oidc").map((config) => config.key)).toEqual([firstKey, secondKey]);
    expect(await getExternalProviderConfig(secondKey)).toMatchObject({ key: secondKey, label: "Second" });
    const summaries = await getExternalProviderSummaries();
    expect(summaries.find((item) => item.key === firstKey)?.callbackUrl).toBe(`https://links.example.com/api/auth/external/${firstKey}/callback`);
    expect(summaries.find((item) => item.key === "oidc")).toMatchObject({ source: "none", logoDataUrl: null });
  });

  it("uses the client ID for a new callback and refuses to overwrite an existing profile", async () => {
    const key = providerProfileKey("oidc", "asetho-link");
    expect(key).toBe("oidc-asetho-link");
    expect(externalProviderType(key)).toBe("oidc");
    await saveExternalProviderSetting("oidc", { ...oidcValues, clientId: "asetho-link", key, newProfile: true });
    const saved = prisma.externalProviderSetting.upsert.mock.calls[0][0].create;
    expect(saved.provider).toBe(key);

    prisma.externalProviderSetting.findUnique.mockResolvedValue(saved);
    await expect(saveExternalProviderSetting("oidc", { ...oidcValues, clientId: "asetho-link", key, newProfile: true }))
      .rejects.toThrow("already uses this callback URL");
    await expect(saveExternalProviderSetting("oidc", { ...oidcValues, clientId: "another-client", key, newProfile: true }))
      .rejects.toThrow("no longer matches the client ID");
    expect(prisma.externalProviderSetting.upsert).toHaveBeenCalledTimes(1);
  });

  it("keeps valid punctuation and non-Latin client IDs usable", () => {
    for (const clientId of ["!!!", "認証クライアント"]) {
      const key = providerProfileKey("oidc", clientId);
      expect(key).toMatch(/^oidc-id-[0-9a-f]{16}$/);
      expect(providerProfileKey("oidc", clientId)).toBe(key);
      expect(externalProviderType(key)).toBe("oidc");
    }
  });

  it("does not merge different client IDs that have the same readable slug", () => {
    const keys = ["client-a", "client.a", "Client-A"].map((clientId) => providerProfileKey("oidc", clientId));
    expect(keys[0]).toBe("oidc-client-a");
    expect(new Set(keys).size).toBe(3);
    expect(keys.every((key) => externalProviderType(key) === "oidc")).toBe(true);
  });

  it("does not copy environment credentials into a new provider profile", async () => {
    await expect(saveExternalProviderSetting("google", { ...googleValues, key: "google--11111111-1111-4111-8111-111111111111", clientSecret: "" }))
      .rejects.toThrow("Enter a client secret");
  });

  it("keeps an environment-configured provider disabled after it is turned off in Settings", async () => {
    await disableExternalProviderSetting("google");
    const row = prisma.externalProviderSetting.create.mock.calls[0][0].data;
    expect(row.enabled).toBe(false);
    expect(decryptSecret(row.secretEncrypted)).toBe("environment-secret");
    prisma.externalProviderSetting.findUnique.mockResolvedValue(row);
    await expect(getExternalProviderConfig("google")).resolves.toBeNull();
  });

  it("removes only the chosen profile and makes its callback unavailable", async () => {
    const removedKey = "google--11111111-1111-4111-8111-111111111111";
    const keptKey = "google--22222222-2222-4222-8222-222222222222";
    await saveExternalProviderSetting("google", { ...googleValues, key: removedKey });
    await saveExternalProviderSetting("google", { ...googleValues, key: keptKey });
    const rows = new Map(prisma.externalProviderSetting.upsert.mock.calls.map(([args]) => [args.create.provider, args.create]));
    prisma.externalProviderSetting.findMany.mockImplementation(async () => [...rows.values()]);
    prisma.externalProviderSetting.findUnique.mockImplementation(async ({ where }) => rows.get(where.provider) ?? null);
    prisma.externalProviderSetting.deleteMany.mockImplementationOnce(async ({ where }) => ({ count: Number(rows.delete(where.provider)) }));

    await removeExternalProviderSetting(removedKey);

    await expect(getExternalProviderConfig(removedKey)).resolves.toBeNull();
    await expect(getExternalProviderConfig(keptKey)).resolves.toMatchObject({ key: keptKey, id: "saved-client" });
    expect((await getExternalProviderSummaries()).some((profile) => profile.key === removedKey)).toBe(false);
  });

  it("clears a removed legacy profile without exposing or reactivating environment credentials", async () => {
    await removeExternalProviderSetting("google");
    const row = prisma.externalProviderSetting.upsert.mock.calls[0][0].create;
    expect(row).toMatchObject({ enabled: false, clientId: "", secretEncrypted: "", logoDataUrl: null });
    prisma.externalProviderSetting.findUnique.mockResolvedValue(row);
    prisma.externalProviderSetting.findMany.mockResolvedValue([row]);

    await expect(getExternalProviderConfig("google")).resolves.toBeNull();
    expect((await getConfiguredExternalProviders()).some((profile) => profile.key === "google")).toBe(false);
    expect((await getExternalProviderSummaries()).find((profile) => profile.key === "google"))
      .toMatchObject({ source: "none", enabled: false, hasSecret: false, clientId: "", label: "Google" });
    await expect(saveExternalProviderSetting("google", { ...googleValues, clientSecret: "" })).rejects.toThrow("Enter a client secret");
  });

  it("requires HTTPS for a custom OIDC issuer", async () => {
    await expect(saveExternalProviderSetting("oidc", {
      clientId: "surls", clientSecret: "secret", label: "Keycloak", issuer: "http://auth.example.com/realms/example", tenantId: ""
    })).rejects.toThrow("HTTPS issuer URL");
    expect(prisma.externalProviderSetting.upsert).not.toHaveBeenCalled();
  });

  it("preserves a trailing slash through save and real OIDC discovery", async () => {
    const issuer = "https://auth.example.com/tenant/";
    await saveExternalProviderSetting("oidc", { ...oidcValues, issuer });
    const saved = prisma.externalProviderSetting.upsert.mock.calls[0][0].create;
    expect(saved.issuer).toBe(issuer);
    prisma.externalProviderSetting.findUnique.mockResolvedValue(saved);
    const config = await getExternalProviderConfig("oidc");
    expect(config).not.toBeNull();
    const fetchMetadata = vi.fn(async () => Response.json({
      issuer, authorization_endpoint: `${issuer}authorize`, token_endpoint: `${issuer}token`,
      jwks_uri: `${issuer}jwks`, response_types_supported: ["code"],
      subject_types_supported: ["public"], id_token_signing_alg_values_supported: ["RS256"]
    }));
    vi.stubGlobal("fetch", fetchMetadata);
    try {
      const url = await externalAuthorizationUrl("oidc", "state", "verifier", "nonce", config!);
      expect(url.origin + url.pathname).toBe(`${issuer}authorize`);
      expect(fetchMetadata).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the linked-identity namespace when saving unchanged environment OIDC credentials", async () => {
    providerEnvironment.OIDC_ISSUER = "https://auth.example.com/tenant/";
    providerEnvironment.OIDC_CLIENT_ID = "environment-oidc-client";
    providerEnvironment.OIDC_CLIENT_SECRET = "environment-oidc-secret";
    const before = await getExternalProviderConfig("oidc");
    await saveExternalProviderSetting("oidc", {
      ...oidcValues, clientId: before!.id, clientSecret: "", issuer: before!.issuer
    });
    const saved = prisma.externalProviderSetting.upsert.mock.calls[0][0].create;
    prisma.externalProviderSetting.findUnique.mockResolvedValue(saved);
    const after = await getExternalProviderConfig("oidc");
    expect(externalProviderKey(after!)).toBe(externalProviderKey(before!));
    expect(externalProviderKey(after!)).toBe("oidc:https://auth.example.com/tenant/");
  });

  it("saves an OIDC logo, keeps it on edit, and can restore the default", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';
    await saveExternalProviderSetting("oidc", {
      ...oidcValues, logoFile: new File([svg], "logo.svg", { type: "image/svg+xml" })
    });
    const first = prisma.externalProviderSetting.upsert.mock.calls[0][0].create;
    expect(first.logoDataUrl).toBe(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);

    prisma.externalProviderSetting.findUnique.mockResolvedValue(first);
    await saveExternalProviderSetting("oidc", { ...oidcValues, clientSecret: "" });
    expect(prisma.externalProviderSetting.upsert.mock.calls[1][0].update.logoDataUrl).toBe(first.logoDataUrl);

    await saveExternalProviderSetting("oidc", { ...oidcValues, clientSecret: "", removeLogo: "on" });
    expect(prisma.externalProviderSetting.upsert.mock.calls[2][0].update.logoDataUrl).toBeNull();
  });

  it("accepts raw base64 and data URIs, but rejects active SVG content", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1"/></svg>';
    const encoded = Buffer.from(svg).toString("base64");
    await saveExternalProviderSetting("oidc", { ...oidcValues, logoBase64: encoded });
    expect(prisma.externalProviderSetting.upsert.mock.calls[0][0].create.logoDataUrl).toBe(`data:image/svg+xml;base64,${encoded}`);

    await saveExternalProviderSetting("oidc", { ...oidcValues, logoBase64: `data:image/svg+xml;base64,${encoded}` });
    expect(prisma.externalProviderSetting.upsert.mock.calls[1][0].create.logoDataUrl).toBe(`data:image/svg+xml;base64,${encoded}`);

    const activeSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64");
    await expect(saveExternalProviderSetting("oidc", { ...oidcValues, logoBase64: activeSvg })).rejects.toThrow("cannot contain scripts");
    expect(prisma.externalProviderSetting.upsert).toHaveBeenCalledTimes(2);
  });

  it("rejects oversized or mislabeled logo uploads", async () => {
    await expect(saveExternalProviderSetting("oidc", {
      ...oidcValues, logoFile: new File([new Uint8Array(256 * 1024 + 1)], "big.png", { type: "image/png" })
    })).rejects.toThrow("256 KB or smaller");
    await expect(saveExternalProviderSetting("oidc", {
      ...oidcValues, logoFile: new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], "wrong.png", { type: "image/png" })
    })).rejects.toThrow("does not match");
    expect(prisma.externalProviderSetting.upsert).not.toHaveBeenCalled();
  });

  it.each(["google", "github", "discord", "microsoft", "facebook", "x"] as const)("uses the built-in %s logo even for older profiles with a custom logo", async (provider) => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1"/></svg>';
    const logo = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    const values = { ...googleValues, tenantId: "example.com", logoBase64: logo, logoFile: new File([svg], "logo.svg", { type: "image/svg+xml" }) };
    await saveExternalProviderSetting(provider, values);
    const saved = prisma.externalProviderSetting.upsert.mock.calls[0][0].create;
    expect(saved.logoDataUrl).toBeNull();

    const olderProfile = { ...saved, logoDataUrl: logo };
    prisma.externalProviderSetting.findUnique.mockResolvedValue(olderProfile);
    prisma.externalProviderSetting.findMany.mockResolvedValue([olderProfile]);
    await expect(getExternalProviderConfig(provider)).resolves.toMatchObject({ logoDataUrl: null });
    expect((await getExternalProviderSummaries()).find((profile) => profile.key === provider)?.logoDataUrl).toBeNull();

    await saveExternalProviderSetting(provider, { ...values, clientSecret: "" });
    expect(prisma.externalProviderSetting.upsert.mock.calls[1][0].update).toMatchObject({ logoDataUrl: null, secretEncrypted: saved.secretEncrypted });
  });
});
