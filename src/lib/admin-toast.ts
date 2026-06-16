export type AdminToastType = "error" | "success";

const ADMIN_TOAST_TYPES = new Set<AdminToastType>(["error", "success"]);
const MAX_TOAST_MESSAGE_LENGTH = 240;

function cleanAdminPath(value: unknown, fallbackPath: string) {
  const raw = typeof value === "string" && value.trim() ? value.trim() : fallbackPath;
  if (!raw.startsWith("/admin") || raw.startsWith("//")) return fallbackPath;

  try {
    const url = new URL(raw, "https://surls.local");
    if (!url.pathname.startsWith("/admin")) return fallbackPath;
    url.searchParams.delete("toast");
    url.searchParams.delete("toastType");
    return `${url.pathname}${url.search}`;
  } catch {
    return fallbackPath;
  }
}

export function adminToastPath(path: unknown, type: AdminToastType, message: string, fallbackPath = "/admin") {
  const safePath = cleanAdminPath(path, fallbackPath);
  const url = new URL(safePath, "https://surls.local");
  url.searchParams.set("toast", message.slice(0, MAX_TOAST_MESSAGE_LENGTH));
  url.searchParams.set("toastType", type);
  return `${url.pathname}${url.search}`;
}

export function adminToastPathFromFormData(
  formData: FormData,
  type: AdminToastType,
  message: string,
  fallbackPath: string
) {
  return adminToastPath(formData.get("returnTo"), type, message, fallbackPath);
}

export function normalizeAdminToastType(type: string | null): AdminToastType {
  return ADMIN_TOAST_TYPES.has(type as AdminToastType) ? (type as AdminToastType) : "success";
}
