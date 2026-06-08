import { randomToken, signValue, verifySignedValue } from "./crypto";

const CSRF_MAX_AGE_MS = 60 * 60 * 1000;

export function getCsrfToken() {
  return signValue(`${Date.now()}.${randomToken(24)}`);
}

export function validateCsrf(formData: FormData) {
  const submitted = String(formData.get("csrf") ?? "");
  const value = verifySignedValue(submitted);
  const issuedAt = value ? Number(value.split(".")[0]) : Number.NaN;
  if (!value || Number.isNaN(issuedAt) || Date.now() - issuedAt > CSRF_MAX_AGE_MS) {
    throw new Error("Invalid CSRF token.");
  }
}
