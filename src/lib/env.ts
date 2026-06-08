import { z } from "zod";

function emptyToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema);
}

const envSchema = z.object({
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
});

export const env = envSchema.parse(process.env);

export function appBaseUrl() {
  return env.BASE_URL.replace(/\/$/, "");
}

export function isProduction() {
  return env.NODE_ENV === "production";
}
