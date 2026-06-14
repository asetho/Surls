"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit";
import { requireSiteAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { CUSTOM_PAGE_SETTINGS, isCustomPageKind, pageFromUpload } from "@/lib/custom-pages";
import { DEFAULT_DASHBOARD_THEME, dashboardThemeFromFormData } from "@/lib/dashboard-theme";
import { requireDisplayTimeZone } from "@/lib/dates";
import { faviconsWithManifestNames } from "@/lib/favicons";
import { getSettings, normalizeSiteName, setSetting } from "@/lib/settings";

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
  revalidatePath("/admin/settings/theme");
  revalidatePath("/admin/settings/favicons/editor");
}

export async function updateDashboardThemeAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireSiteAdmin();
  if (!admin) throw new Error("Only admins can update dashboard theme.");

  const dashboardTheme = dashboardThemeFromFormData(formData);
  await setSetting("dashboardTheme", dashboardTheme);
  await auditLog({
    userId: admin.id,
    action: AuditAction.SETTINGS_CHANGED,
    entityType: "AppSetting",
    entityId: "dashboardTheme",
    details: { dashboardTheme }
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/theme");
}

export async function resetDashboardThemeAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireSiteAdmin();
  if (!admin) throw new Error("Only admins can update dashboard theme.");

  await setSetting("dashboardTheme", DEFAULT_DASHBOARD_THEME);
  await auditLog({
    userId: admin.id,
    action: AuditAction.SETTINGS_CHANGED,
    entityType: "AppSetting",
    entityId: "dashboardTheme",
    details: { dashboardTheme: "default" }
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/theme");
}

function revalidateCustomPagePaths() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/2fa");
  revalidatePath("/admin/settings");
}

function revalidateFaviconPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/favicons/editor");
  revalidatePath("/favicon.ico");
  revalidatePath("/favicon.svg");
  revalidatePath("/apple-touch-icon.png");
  revalidatePath("/icon-192.png");
  revalidatePath("/icon-512.png");
  revalidatePath("/site.webmanifest");
}

export async function uploadCustomPageAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireSiteAdmin();
  if (!admin) throw new Error("Only admins can update custom pages.");

  const kind = formData.get("kind");
  if (!isCustomPageKind(kind)) throw new Error("Choose a valid custom page type.");
  if (kind !== "login") throw new Error("Public pages are served from the mounted webroot.");

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

export async function resetFaviconsAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireSiteAdmin();
  if (!admin) throw new Error("Only admins can update favicons.");

  await setSetting("favicons", null);
  await auditLog({
    userId: admin.id,
    action: AuditAction.SETTINGS_CHANGED,
    entityType: "AppSetting",
    entityId: "favicons",
    details: { favicons: true, removed: true }
  });
  revalidateFaviconPaths();
}

export async function updateFaviconManifestAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireSiteAdmin();
  if (!admin) throw new Error("Only admins can update favicons.");

  const settings = await getSettings();
  if (!settings.favicons) throw new Error("Upload a favicon package before saving web app names.");

  const favicons = faviconsWithManifestNames(settings.favicons, formData, settings.siteName);
  await setSetting("favicons", favicons);
  await auditLog({
    userId: admin.id,
    action: AuditAction.SETTINGS_CHANGED,
    entityType: "AppSetting",
    entityId: "favicons",
    details: {
      favicons: true,
      manifestName: favicons.manifestName,
      manifestShortName: favicons.manifestShortName
    }
  });
  revalidateFaviconPaths();
}
