import { safeRedirectPath } from "./redirect-path";

export function adminLoginPath(nextPath?: unknown) {
  const safeNextPath = safeRedirectPath(nextPath);
  if (safeNextPath === "/admin") return "/admin";

  const params = new URLSearchParams({ next: safeNextPath });
  return `/admin?${params.toString()}`;
}
