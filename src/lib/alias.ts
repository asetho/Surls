export const RESERVED_ALIASES = new Set([
  "admin",
  "api",
  "assets",
  "cookies",
  "health",
  "login",
  "logout",
  "privacy",
  "s",
  "static",
  "_next",
  "apple-touch-icon.png",
  "favicon.ico",
  "favicon.svg",
  "icon-192.png",
  "icon-512.png",
  "robots.txt",
  "site.webmanifest"
]);

const ALIAS_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/;
const CONFUSING_CHARS = /[IlO0]/;

export function normalizeAlias(alias: string) {
  return alias.trim();
}

export function isReservedAlias(alias: string) {
  return RESERVED_ALIASES.has(alias.toLowerCase());
}

export function validateAlias(alias: string) {
  const normalized = normalizeAlias(alias);
  if (!ALIAS_PATTERN.test(normalized)) {
    return "Aliases must be 3-64 characters and use only letters, numbers, underscores, or hyphens.";
  }
  if (normalized.includes("..") || normalized.includes("/") || normalized.includes("\\")) {
    return "Aliases cannot contain path traversal characters.";
  }
  if (isReservedAlias(normalized)) {
    return "This alias is reserved for Surls system routes.";
  }
  if (CONFUSING_CHARS.test(normalized)) {
    return "Avoid visually confusing characters like I, l, O, or 0.";
  }
  return null;
}

export function generateAlias(length = 7) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
