import path from "node:path";
import { z } from "zod";

function emptyToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema);
}

const INSECURE_AUTH_SECRETS = new Set([
  "change-this-before-production",
  "development-secret-change-before-production",
  "replace-with-at-least-32-random-bytes",
  "replace-with-at-least-32-random-characters",
  "test-secret-that-is-long-enough-for-surls"
]);

export function isInsecureAuthSecret(value: string | undefined) {
  const secret = value?.trim() ?? "";
  if (secret.length < 32) return true;
  if (INSECURE_AUTH_SECRETS.has(secret)) return true;
  if (/replace|change|example|placeholder|secret/i.test(secret)) return true;
  if (new Set(secret).size < 10) return true;
  return false;
}

function isNextProductionBuild() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

const envSchema = z
  .object({
    APP_NAME: emptyToUndefined(z.string().default("Surls")),
    BASE_URL: emptyToUndefined(z.string().url().default("http://localhost:3000")),
    SURLS_LOGIN_DEV_ENABLED: emptyToUndefined(
      z.enum(["true", "false"]).default("false").transform((value) => value === "true")
    ),
    AUTH_SECRET: emptyToUndefined(z.string().min(32).default("development-secret-change-before-production")),
    SMTP_HOST: emptyToUndefined(z.string().optional()),
    SMTP_PORT: emptyToUndefined(z.coerce.number().int().min(1).max(65535).default(587)),
    SMTP_USER: emptyToUndefined(z.string().optional()),
    SMTP_PASSWORD: emptyToUndefined(z.string().optional()),
    SMTP_FROM: emptyToUndefined(z.email().optional()),
    OIDC_ISSUER: emptyToUndefined(z.string().url().max(512).optional()),
    OIDC_CLIENT_ID: emptyToUndefined(z.string().optional()),
    OIDC_CLIENT_SECRET: emptyToUndefined(z.string().optional()),
    OIDC_PROVIDER_NAME: emptyToUndefined(z.string().max(80).default("Single sign-on")),
    GOOGLE_CLIENT_ID: emptyToUndefined(z.string().optional()),
    GOOGLE_CLIENT_SECRET: emptyToUndefined(z.string().optional()),
    FACEBOOK_CLIENT_ID: emptyToUndefined(z.string().optional()),
    FACEBOOK_CLIENT_SECRET: emptyToUndefined(z.string().optional()),
    X_CLIENT_ID: emptyToUndefined(z.string().optional()),
    X_CLIENT_SECRET: emptyToUndefined(z.string().optional()),
    GITHUB_CLIENT_ID: emptyToUndefined(z.string().optional()),
    GITHUB_CLIENT_SECRET: emptyToUndefined(z.string().optional()),
    DISCORD_CLIENT_ID: emptyToUndefined(z.string().optional()),
    DISCORD_CLIENT_SECRET: emptyToUndefined(z.string().optional()),
    MICROSOFT_CLIENT_ID: emptyToUndefined(z.string().optional()),
    MICROSOFT_CLIENT_SECRET: emptyToUndefined(z.string().optional()),
    MICROSOFT_TENANT_ID: emptyToUndefined(z.string().optional()),
    CUSTOM_PAGES_DIR: emptyToUndefined(z.string().default("/app/www")),
    PUBLIC_WEBROOT_DIR: emptyToUndefined(z.string().optional()),
    UPLOADS_DIR: emptyToUndefined(z.string().optional()),
    UPLOAD_MAX_BYTES: emptyToUndefined(z.coerce.number().int().positive().max(25 * 1024 * 1024).default(25 * 1024 * 1024)),
    UPLOAD_USER_STORAGE_QUOTA_BYTES: emptyToUndefined(
      z.coerce.number().int().positive().max(100 * 1024 * 1024 * 1024).default(1024 * 1024 * 1024)
    ),
    UPLOAD_SITE_STORAGE_QUOTA_BYTES: emptyToUndefined(
      z.coerce.number().int().positive().max(1024 * 1024 * 1024 * 1024).default(10 * 1024 * 1024 * 1024)
    ),
    DATABASE_URL: emptyToUndefined(z.string().optional()),
    SESSION_DAYS: emptyToUndefined(z.coerce.number().int().positive().default(14)),
    API_TOKEN_DAYS: emptyToUndefined(z.coerce.number().int().positive().default(90)),
    CLICK_EVENT_RETENTION_DAYS: emptyToUndefined(z.coerce.number().int().positive().default(365)),
    AUDIT_LOG_RETENTION_DAYS: emptyToUndefined(z.coerce.number().int().positive().default(365)),
    ALLOW_PRIVATE_DESTINATIONS: emptyToUndefined(
      z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true")
    ),
    TRUST_PROXY: emptyToUndefined(
      z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true")
    ),
    TURNSTILE_SITE_KEY: emptyToUndefined(z.string().optional()),
    TURNSTILE_SECRET_KEY: emptyToUndefined(z.string().optional()),
    WEBAUTHN_RP_ID: emptyToUndefined(z.string().default("localhost")),
    WEBAUTHN_ORIGIN: emptyToUndefined(z.string().url().default("http://localhost:3000")),
    NODE_ENV: emptyToUndefined(z.enum(["development", "test", "production"]).default("development"))
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && !isNextProductionBuild() && isInsecureAuthSecret(value.AUTH_SECRET)) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_SECRET"],
        message: "AUTH_SECRET must be changed to a high-entropy value in production."
      });
    }

    if (Boolean(value.TURNSTILE_SITE_KEY) !== Boolean(value.TURNSTILE_SECRET_KEY)) {
      ctx.addIssue({
        code: "custom",
        path: ["TURNSTILE_SITE_KEY"],
        message: "TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must be configured together."
      });
    }
    if (Boolean(value.SMTP_HOST) !== Boolean(value.SMTP_FROM) || Boolean(value.SMTP_USER) !== Boolean(value.SMTP_PASSWORD)) {
      ctx.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "Configure SMTP_HOST and SMTP_FROM together, and provide both SMTP_USER and SMTP_PASSWORD when using authentication." });
    }
    const oidcValues = [value.OIDC_ISSUER, value.OIDC_CLIENT_ID, value.OIDC_CLIENT_SECRET];
    if (oidcValues.some(Boolean) && !oidcValues.every(Boolean)) {
      ctx.addIssue({
        code: "custom",
        path: ["OIDC_ISSUER"],
        message: "OIDC_ISSUER, OIDC_CLIENT_ID, and OIDC_CLIENT_SECRET must be configured together."
      });
    }
    for (const provider of ["GOOGLE", "FACEBOOK", "X", "GITHUB", "DISCORD", "MICROSOFT"] as const) {
      if (Boolean(value[`${provider}_CLIENT_ID`]) !== Boolean(value[`${provider}_CLIENT_SECRET`])) {
        ctx.addIssue({
          code: "custom",
          path: [`${provider}_CLIENT_ID`],
          message: `${provider}_CLIENT_ID and ${provider}_CLIENT_SECRET must be configured together.`
        });
      }
    }
    if (Boolean(value.MICROSOFT_CLIENT_ID) !== Boolean(value.MICROSOFT_TENANT_ID)) {
      ctx.addIssue({ code: "custom", path: ["MICROSOFT_TENANT_ID"], message: "MICROSOFT_TENANT_ID is required with Microsoft credentials." });
    }
    if (value.MICROSOFT_TENANT_ID && (!/^[A-Za-z0-9.-]+$/.test(value.MICROSOFT_TENANT_ID) || ["common", "organizations", "consumers"].includes(value.MICROSOFT_TENANT_ID))) {
      ctx.addIssue({ code: "custom", path: ["MICROSOFT_TENANT_ID"], message: "Set a specific Microsoft tenant ID or domain." });
    }
    if (value.NODE_ENV === "production" && !isNextProductionBuild() && oidcValues.some(Boolean)) {
      if (value.OIDC_ISSUER && !value.OIDC_ISSUER.startsWith("https://")) {
        ctx.addIssue({ code: "custom", path: ["OIDC_ISSUER"], message: "OIDC_ISSUER must use HTTPS in production." });
      }
    }
    if (value.OIDC_ISSUER) {
      const issuer = new URL(value.OIDC_ISSUER);
      if (issuer.search || issuer.hash) {
        ctx.addIssue({ code: "custom", path: ["OIDC_ISSUER"], message: "OIDC_ISSUER must not contain a query or fragment." });
      }
    }
    if (value.NODE_ENV === "production" && !isNextProductionBuild() &&
        [...oidcValues, value.GOOGLE_CLIENT_ID, value.GITHUB_CLIENT_ID, value.DISCORD_CLIENT_ID,
          value.MICROSOFT_CLIENT_ID, value.FACEBOOK_CLIENT_ID, value.X_CLIENT_ID].some(Boolean) &&
        !value.BASE_URL.startsWith("https://")) {
      ctx.addIssue({ code: "custom", path: ["BASE_URL"], message: "External sign-in requires an HTTPS BASE_URL in production." });
    }
  });

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  PUBLIC_WEBROOT_DIR: parsedEnv.PUBLIC_WEBROOT_DIR ?? parsedEnv.CUSTOM_PAGES_DIR,
  UPLOADS_DIR: parsedEnv.UPLOADS_DIR ?? path.join(process.cwd(), "uploads")
};

export function appBaseUrl() {
  return env.BASE_URL.replace(/\/$/, "");
}

export function isProduction() {
  return env.NODE_ENV === "production";
}
