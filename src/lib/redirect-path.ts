const INTERNAL_REDIRECT_BASE = new URL("https://surls.invalid");
const ASCII_CONTROL = /[\u0000-\u001f\u007f]/;

function canonicalInternalPath(value: unknown) {
  const path = String(value ?? "");
  if (!path.startsWith("/") || path.includes("\\") || ASCII_CONTROL.test(path)) return null;

  try {
    const parsed = new URL(path, INTERNAL_REDIRECT_BASE);
    if (parsed.origin !== INTERNAL_REDIRECT_BASE.origin) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function safeRedirectPath(value: unknown, fallback = "/admin") {
  return canonicalInternalPath(value) ?? canonicalInternalPath(fallback) ?? "/admin";
}
