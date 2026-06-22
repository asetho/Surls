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
    AUTH_SECRET: emptyToUndefined(z.string().min(32).default("development-secret-change-before-production")),
    CUSTOM_PAGES_DIR: emptyToUndefined(z.string().default("/app/www")),
    PUBLIC_WEBROOT_DIR: emptyToUndefined(z.string().optional()),
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
  });

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  PUBLIC_WEBROOT_DIR: parsedEnv.PUBLIC_WEBROOT_DIR ?? parsedEnv.CUSTOM_PAGES_DIR
};

export function appBaseUrl() {
  return env.BASE_URL.replace(/\/$/, "");
}

export function isProduction() {
  return env.NODE_ENV === "production";
}
