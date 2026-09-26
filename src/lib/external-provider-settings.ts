import type { ExternalProviderSetting, Prisma } from "@prisma/client";
import { decryptSecret, encryptSecret } from "./crypto";
import { appBaseUrl, env } from "./env";
import { validateSvgImage } from "./favicons";
import { prisma } from "./prisma";
import { providerProfileKey } from "./provider-profile-key";

type ProviderSettingsClient = Pick<Prisma.TransactionClient, "externalProviderSetting">;

export const EXTERNAL_PROVIDERS = ["oidc", "google", "github", "discord", "microsoft", "facebook", "x"] as const;
export type ExternalProvider = (typeof EXTERNAL_PROVIDERS)[number];

const PROVIDER_NAMES: Record<ExternalProvider, string> = {
  oidc: "OpenID Connect",
  google: "Google",
  github: "GitHub",
  discord: "Discord",
  microsoft: "Microsoft",
  facebook: "Facebook",
  x: "X/Twitter"
};

export type ExternalProviderConfig = {
  key: string;
  provider: ExternalProvider;
  id: string;
  secret: string;
  label: string;
  logoDataUrl: string | null;
  issuer: string | null;
  tenantId: string | null;
  source: "settings" | "environment";
};

export type ExternalProviderSummary = {
  key: string;
  provider: ExternalProvider;
  name: string;
  label: string;
  logoDataUrl: string | null;
  clientId: string;
  issuer: string;
  tenantId: string;
  source: "settings" | "environment" | "none";
  enabled: boolean;
  hasSecret: boolean;
  needsSecret: boolean;
  callbackUrl: string;
};

export class ExternalProviderSettingsError extends Error {}

export function isExternalProvider(value: unknown): value is ExternalProvider {
  return typeof value === "string" && EXTERNAL_PROVIDERS.some((provider) => provider === value);
}

export function externalProviderType(key: unknown): ExternalProvider | null {
  if (isExternalProvider(key)) return key;
  if (typeof key !== "string") return null;
  const match = /^([a-z]+)--[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.exec(key) ??
    /^([a-z]+)-[a-z0-9]+(?:-[a-z0-9]+)*$/.exec(key.length <= 128 ? key : "");
  return match && isExternalProvider(match[1]) ? match[1] : null;
}

export function externalCallbackUrl(key: string) {
  return `${appBaseUrl()}/api/auth/external/${key}/callback`;
}

export function externalProviderKey(config: ExternalProviderConfig) {
  const legacyKey = config.provider === "oidc" ? `oidc:${config.issuer}` :
    config.provider === "microsoft" ? `microsoft:${config.tenantId}` : config.provider;
  return config.key === config.provider ? legacyKey : `${legacyKey}:instance:${config.key}`;
}

export function environmentExternalProviderConfig(provider: ExternalProvider): ExternalProviderConfig | null {
  const pair = (id: string | undefined, secret: string | undefined, issuer: string | null = null, tenantId: string | null = null) =>
    id && secret ? { key: provider, provider, id, secret, label: PROVIDER_NAMES[provider], logoDataUrl: null, issuer, tenantId, source: "environment" as const } : null;
  if (provider === "oidc") {
    const config = pair(env.OIDC_CLIENT_ID, env.OIDC_CLIENT_SECRET, env.OIDC_ISSUER ?? null);
    return config && config.issuer ? { ...config, label: env.OIDC_PROVIDER_NAME } : null;
  }
  if (provider === "google") return pair(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  if (provider === "github") return pair(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET);
  if (provider === "discord") return pair(env.DISCORD_CLIENT_ID, env.DISCORD_CLIENT_SECRET);
  if (provider === "microsoft") {
    const config = pair(env.MICROSOFT_CLIENT_ID, env.MICROSOFT_CLIENT_SECRET, null, env.MICROSOFT_TENANT_ID ?? null);
    return config?.tenantId ? config : null;
  }
  if (provider === "facebook") return pair(env.FACEBOOK_CLIENT_ID, env.FACEBOOK_CLIENT_SECRET);
  return pair(env.X_CLIENT_ID, env.X_CLIENT_SECRET);
}

function storedConfig(row: ExternalProviderSetting): ExternalProviderConfig | null {
  const provider = externalProviderType(row.provider);
  if (!row.enabled || !provider) return null;
  try {
    const secret = decryptSecret(row.secretEncrypted);
    if (!row.clientId || !secret || (provider === "oidc" && !row.issuer) ||
        (provider === "microsoft" && !row.tenantId)) return null;
    return { key: row.provider, provider, id: row.clientId, secret, label: row.label, logoDataUrl: provider === "oidc" ? row.logoDataUrl : null,
      issuer: row.issuer, tenantId: row.tenantId, source: "settings" };
  } catch {
    return null;
  }
}

function effectiveConfig(provider: ExternalProvider, row: ExternalProviderSetting | undefined | null) {
  return row ? storedConfig(row) : environmentExternalProviderConfig(provider);
}

export async function getExternalProviderConfig(key: string) {
  const provider = externalProviderType(key);
  if (!provider) return null;
  const row = await prisma.externalProviderSetting.findUnique({ where: { provider: key } });
  return row ? storedConfig(row) : key === provider ? environmentExternalProviderConfig(provider) : null;
}

export async function getConfiguredExternalProviders(client: ProviderSettingsClient = prisma) {
  const rows = await client.externalProviderSetting.findMany();
  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  return [...EXTERNAL_PROVIDERS.map((provider) => effectiveConfig(provider, byProvider.get(provider))),
    ...rows.filter((row) => !isExternalProvider(row.provider)).map(storedConfig)].filter(
    (config): config is ExternalProviderConfig => config !== null
  );
}

export async function getExternalProviderSummaries(): Promise<ExternalProviderSummary[]> {
  const rows = await prisma.externalProviderSetting.findMany();
  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  const summary = (provider: ExternalProvider, key: string, row?: ExternalProviderSetting): ExternalProviderSummary => {
    const fromEnvironment = key === provider && !row ? environmentExternalProviderConfig(provider) : null;
    const config = row ? storedConfig(row) : fromEnvironment;
    return {
      key,
      provider,
      name: PROVIDER_NAMES[provider],
      label: row?.label || fromEnvironment?.label || PROVIDER_NAMES[provider],
      logoDataUrl: provider === "oidc" ? row?.logoDataUrl ?? null : null,
      clientId: row?.clientId || fromEnvironment?.id || "",
      issuer: row?.issuer || fromEnvironment?.issuer || "",
      tenantId: row?.tenantId || fromEnvironment?.tenantId || "",
      source: row ? (!row.enabled && !row.clientId && !row.secretEncrypted ? "none" : "settings") : fromEnvironment ? "environment" : "none",
      enabled: Boolean(config),
      hasSecret: Boolean(row?.secretEncrypted || fromEnvironment?.secret),
      needsSecret: Boolean(row?.enabled && !config),
      callbackUrl: externalCallbackUrl(key)
    };
  };
  return [...EXTERNAL_PROVIDERS.map((provider) => summary(provider, provider, byProvider.get(provider))),
    ...rows.flatMap((row) => {
      if (isExternalProvider(row.provider)) return [];
      const provider = externalProviderType(row.provider);
      return provider ? [summary(provider, row.provider, row)] : [];
    })];
}

function requiredText(value: unknown, label: string, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maxLength || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new ExternalProviderSettingsError(`Enter a valid ${label}.`);
  }
  return text;
}

function optionalSecret(value: unknown) {
  const secret = typeof value === "string" && value.trim() ? value : "";
  if (secret.length > 4096) throw new ExternalProviderSettingsError("The client secret is too long.");
  return secret;
}

function validatedIssuer(value: unknown) {
  const raw = requiredText(value, "issuer URL", 512);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ExternalProviderSettingsError("Enter a valid HTTPS issuer URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.toString().replace(/\/$/, "") !== raw.replace(/\/$/, "")) {
    throw new ExternalProviderSettingsError("Enter a valid HTTPS issuer URL without credentials, a query, or a fragment.");
  }
  return raw;
}

function validatedTenant(value: unknown) {
  const tenant = requiredText(value, "Microsoft tenant ID or domain", 253);
  if (!/^[A-Za-z0-9.-]+$/.test(tenant) || ["common", "organizations", "consumers"].includes(tenant.toLowerCase())) {
    throw new ExternalProviderSettingsError("Set a specific Microsoft tenant ID or domain.");
  }
  return tenant;
}

const MAX_PROVIDER_LOGO_BYTES = 256 * 1024;
const DATA_IMAGE_PREFIX = /^data:(image\/(?:svg\+xml|png|webp|jpeg));base64,([\s\S]+)$/i;

function logoMimeType(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  try {
    const svg = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (/^(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/i.test(svg.trim())) {
      validateSvgImage(svg, "SVG logo");
      return "image/svg+xml";
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("SVG logo")) throw new ExternalProviderSettingsError(error.message);
  }
  throw new ExternalProviderSettingsError("Choose an SVG, PNG, WebP, or JPEG logo.");
}

function logoDataUrl(bytes: Buffer, reportedMimeType?: string) {
  if (!bytes.length || bytes.length > MAX_PROVIDER_LOGO_BYTES) {
    throw new ExternalProviderSettingsError("The logo must be 256 KB or smaller.");
  }
  const mimeType = logoMimeType(bytes);
  if (reportedMimeType && reportedMimeType !== mimeType) {
    throw new ExternalProviderSettingsError("The logo content does not match its image type.");
  }
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

async function validatedProviderLogo(upload: unknown, pasted: unknown, remove: unknown, existing: string | null) {
  const file = upload instanceof File && upload.size ? upload : null;
  const pastedCode = typeof pasted === "string" ? pasted.trim() : "";
  const removeLogo = remove === "on";
  if (Number(Boolean(file)) + Number(Boolean(pastedCode)) + Number(removeLogo) > 1) {
    throw new ExternalProviderSettingsError("Upload a logo, paste base64, or remove the current logo—choose one.");
  }
  if (removeLogo) return null;
  if (file) {
    if (file.size > MAX_PROVIDER_LOGO_BYTES) throw new ExternalProviderSettingsError("The logo must be 256 KB or smaller.");
    return logoDataUrl(Buffer.from(await file.arrayBuffer()), file.type || undefined);
  }
  if (pastedCode) {
    const dataUri = DATA_IMAGE_PREFIX.exec(pastedCode);
    if (pastedCode.startsWith("data:") && !dataUri) {
      throw new ExternalProviderSettingsError("Paste a base64 SVG, PNG, WebP, or JPEG data URI.");
    }
    const base64 = (dataUri?.[2] ?? pastedCode).replace(/\s/g, "");
    if (base64.length > Math.ceil(MAX_PROVIDER_LOGO_BYTES * 4 / 3) + 2 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
      throw new ExternalProviderSettingsError("Paste a valid base64 logo of 256 KB or smaller.");
    }
    const bytes = Buffer.from(base64, "base64");
    if (bytes.toString("base64") !== base64) throw new ExternalProviderSettingsError("Paste a valid base64 logo.");
    return logoDataUrl(bytes, dataUri?.[1]?.toLowerCase());
  }
  return existing;
}

export async function saveExternalProviderSetting(provider: ExternalProvider, values: {
  key?: unknown;
  newProfile?: unknown;
  clientId: unknown;
  clientSecret: unknown;
  label: unknown;
  issuer: unknown;
  tenantId: unknown;
  logoFile?: unknown;
  logoBase64?: unknown;
  removeLogo?: unknown;
}, client: ProviderSettingsClient = prisma) {
  const key = values.key === undefined ? provider : values.key;
  if (typeof key !== "string" || externalProviderType(key) !== provider) {
    throw new ExternalProviderSettingsError("Choose a valid provider profile.");
  }
  const clientId = requiredText(values.clientId, "client ID", 512);
  const issuer = provider === "oidc" ? validatedIssuer(values.issuer) : null;
  const tenantId = provider === "microsoft" ? validatedTenant(values.tenantId) : null;
  const label = provider === "oidc" || (typeof values.label === "string" && values.label.trim())
    ? requiredText(values.label, "button label", 80) : PROVIDER_NAMES[provider];
  const newSecret = optionalSecret(values.clientSecret);
  const existing = await client.externalProviderSetting.findUnique({ where: { provider: key } });
  if (values.newProfile === true) {
    if (key !== providerProfileKey(provider, clientId)) {
      throw new ExternalProviderSettingsError("The callback URL no longer matches the client ID. Try adding the provider again.");
    }
    if (existing) {
      throw new ExternalProviderSettingsError("A provider profile already uses this callback URL. Choose a different client ID.");
    }
  }
  const logo = provider === "oidc"
    ? await validatedProviderLogo(values.logoFile, values.logoBase64, values.removeLogo, existing?.logoDataUrl ?? null)
    : null;
  const environmentConfig = existing || key !== provider ? null : environmentExternalProviderConfig(provider);
  if (!newSecret && (existing?.secretEncrypted || environmentConfig?.secret)) {
    if (clientId !== (existing ? existing.clientId : environmentConfig?.id)) {
      throw new ExternalProviderSettingsError("Enter a new client secret when changing the client ID.");
    }
    if (provider === "oidc" && issuer !== (existing ? existing.issuer : environmentConfig?.issuer)) {
      throw new ExternalProviderSettingsError("Enter a new client secret when changing the issuer URL.");
    }
    if (provider === "microsoft" && tenantId !== (existing ? existing.tenantId : environmentConfig?.tenantId)) {
      throw new ExternalProviderSettingsError("Enter a new client secret when changing the Microsoft tenant.");
    }
  }
  const environmentSecret = environmentConfig?.secret;
  if (!newSecret && existing?.secretEncrypted) {
    try {
      decryptSecret(existing.secretEncrypted);
    } catch {
      throw new ExternalProviderSettingsError("Enter a new client secret; the saved secret cannot be read.");
    }
  }
  const secretEncrypted = newSecret ? encryptSecret(newSecret) : existing?.secretEncrypted ||
    (environmentSecret ? encryptSecret(environmentSecret) : null);
  if (!secretEncrypted) throw new ExternalProviderSettingsError("Enter a client secret.");
  return client.externalProviderSetting.upsert({
    where: { provider: key },
    create: { provider: key, clientId, secretEncrypted, issuer, tenantId, label, logoDataUrl: logo, enabled: true },
    update: { clientId, secretEncrypted, issuer, tenantId, label, logoDataUrl: logo, enabled: true }
  });
}

export async function disableExternalProviderSetting(key: string, client: ProviderSettingsClient = prisma) {
  const provider = externalProviderType(key);
  if (!provider) throw new ExternalProviderSettingsError("Choose a valid provider profile.");
  const existing = await client.externalProviderSetting.findUnique({ where: { provider: key } });
  if (existing) return client.externalProviderSetting.update({ where: { provider: key }, data: { enabled: false } });
  if (key !== provider) throw new ExternalProviderSettingsError("This provider is not configured.");
  const config = environmentExternalProviderConfig(provider);
  if (!config) throw new ExternalProviderSettingsError("This provider is not configured.");
  return client.externalProviderSetting.create({ data: {
    provider, clientId: config.id, secretEncrypted: encryptSecret(config.secret), label: config.label,
    issuer: config.issuer, tenantId: config.tenantId, enabled: false
  } });
}

export async function removeExternalProviderSetting(key: string, client: ProviderSettingsClient = prisma) {
  const provider = externalProviderType(key);
  if (!provider) throw new ExternalProviderSettingsError("Choose a valid provider profile.");
  if (key !== provider) {
    await client.externalProviderSetting.deleteMany({ where: { provider: key } });
    return;
  }
  // Keep an empty, disabled override so removing a legacy profile cannot
  // reactivate its environment credentials. Account connections are retained.
  const removed = { enabled: false, clientId: "", secretEncrypted: "", label: "", logoDataUrl: null, issuer: null, tenantId: null };
  await client.externalProviderSetting.upsert({
    where: { provider: key },
    create: { provider: key, ...removed },
    update: removed
  });
}
