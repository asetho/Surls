"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit";
import { requireSiteAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { CUSTOM_PAGE_SETTINGS, isCustomPageKind, pageFromUpload } from "@/lib/custom-pages";
import { requireDisplayTimeZone } from "@/lib/dates";
import { normalizeSiteName, setSetting } from "@/lib/settings";

export async function updateSettingsAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireSiteAdmin();
  if (!admin) throw new Error("Only admins can update settings.");
  const trackAdminClicks = formData.get("trackAdminClicks") === "on";
  const preserveRedirectQuery = formData.get("preserveRedirectQuery") === "on";
  const siteName = normalizeSiteName(formData.get("siteName"));
  const displayTimeZone = requireDisplayTimeZone(formData.get("displayTimeZone"));
  await setSetting("trackAdminClicks", trackAdminClicks);
  await setSetting("preserveRedirectQuery", preserveRedirectQuery);
  await setSetting("siteName", siteName);
  await setSetting("displayTimeZone", displayTimeZone);
  await auditLog({
    userId: admin.id,
    action: AuditAction.SETTINGS_CHANGED,
    entityType: "AppSetting",
    details: {
      siteName,
      displayTimeZone,
      trackAdminClicks,
      preserveRedirectQuery
    }
  });
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/settings");
}

function revalidateCustomPagePaths() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/2fa");
  revalidatePath("/admin/settings");
}

export async function uploadCustomPageAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireSiteAdmin();
  if (!admin) throw new Error("Only admins can update custom pages.");

  const kind = formData.get("kind");
  if (!isCustomPageKind(kind)) throw new Error("Choose a valid custom page type.");

  const page = await pageFromUpload(formData.get("file"), { requireLoginPlaceholder: kind === "login" });
  await setSetting(CUSTOM_PAGE_SETTINGS[kind], page);
  await auditLog({
    userId: admin.id,
    action: AuditAction.SETTINGS_CHANGED,
    entityType: "AppSetting",
    entityId: CUSTOM_PAGE_SETTINGS[kind],
    details: {
      customPage: kind,
      fileName: page.fileName,
      size: page.size
    }
  });
  revalidateCustomPagePaths();
}

export async function resetCustomPageAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireSiteAdmin();
  if (!admin) throw new Error("Only admins can update custom pages.");

  const kind = formData.get("kind");
  if (!isCustomPageKind(kind)) throw new Error("Choose a valid custom page type.");

  await setSetting(CUSTOM_PAGE_SETTINGS[kind], null);
  await auditLog({
    userId: admin.id,
    action: AuditAction.SETTINGS_CHANGED,
    entityType: "AppSetting",
    entityId: CUSTOM_PAGE_SETTINGS[kind],
    details: { customPage: kind, removed: true }
  });
  revalidateCustomPagePaths();
}
