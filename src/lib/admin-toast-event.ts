import { normalizeAdminToastType, type AdminToastType } from "./admin-toast";

export const ADMIN_TOAST_EVENT = "surls-admin-toast";

export function adminToastFromEvent(event: Event) {
  const detail = event instanceof CustomEvent ? (event.detail as unknown) : null;
  if (!detail || typeof detail !== "object") return null;
  const message = "message" in detail && typeof detail.message === "string" ? detail.message : null;
  if (!message) return null;
  const type = "type" in detail && typeof detail.type === "string" ? normalizeAdminToastType(detail.type) : "success";
  return { message, type };
}

export function dispatchAdminToast(type: AdminToastType, message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ADMIN_TOAST_EVENT, { detail: { message, type } }));
}
