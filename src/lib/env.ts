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
    DATABASE_URL: emptyToUndefined(z.string().optional()),
    SESSION_DAYS: emptyToUndefined(z.coerce.number().int().positive().default(14)),
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
  });

export const env = envSchema.parse(process.env);

export function appBaseUrl() {
  return env.BASE_URL.replace(/\/$/, "");
}

export function isProduction() {
  return env.NODE_ENV === "production";
}
