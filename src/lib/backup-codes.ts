import { hashPassword, verifyPassword } from "./password";

export function generateBackupCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const raw = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

export function generateBackupCodes(count = 10) {
  return Array.from({ length: count }, () => generateBackupCode());
}

export async function hashBackupCode(code: string) {
  return hashPassword(normalizeBackupCode(code));
}

export function normalizeBackupCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export async function verifyBackupCode(hash: string, code: string) {
  return verifyPassword(hash, normalizeBackupCode(code));
}
