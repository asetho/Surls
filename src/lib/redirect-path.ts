export function safeRedirectPath(value: unknown, fallback = "/admin") {
  const path = String(value ?? fallback);
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}
