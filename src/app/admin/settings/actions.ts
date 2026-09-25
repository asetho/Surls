"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminToastPath, adminToastPathFromFormData } from "@/lib/admin-toast";
import { auditLog } from "@/lib/audit";
import { requireSiteAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { CUSTOM_PAGE_SETTINGS, isCustomPageKind, pageFromUpload } from "@/lib/custom-pages";
import { DEFAULT_DASHBOARD_THEME, dashboardThemeFromFormData } from "@/lib/dashboard-theme";
import { requireDisplayTimeZone } from "@/lib/dates";
import { faviconsWithManifestNames } from "@/lib/favicons";
import { getSettings, normalizeSiteName, setSetting } from "@/lib/settings";
import { getConfiguredExternalProviders } from "@/lib/external-provider-settings";
import { isConfiguredExternalIdentity } from "@/lib/external-identity";
import { prisma } from "@/lib/prisma";
import { siteUploadLimitFromFormData } from "@/lib/upload-limits";

function actionErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function redirectWithToast(formData: FormData, type: "error" | "success", message: string, fallbackPath: string): never {
  redirect(adminToastPathFromFormData(formData, type, message, fallbackPath));
}

export async function updateSettingsAction(formData: FormData) {
  try {
    validateCsrf(formData);
  } catch {
    redirectWithToast(formData, "error", "The form expired. Please try again.", "/admin/settings");
  }
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminToastPath("/admin", "error", "Sign in again to continue."));
  const trackAdminClicks = formData.get("trackAdminClicks") === "on";
  const preserveRedirectQuery = formData.get("preserveRedirectQuery") === "on";
  const siteName = normalizeSiteName(formData.get("siteName"));
  let uploadMaxBytes: number | null;
  let displayTimeZone: string;
  try {
    displayTimeZone = requireDisplayTimeZone(formData.get("displayTimeZone"));
    uploadMaxBytes = siteUploadLimitFromFormData(formData);
  } catch (error) {
    redirectWithToast(formData, "error", actionErrorMessage(error, "Choose a valid display timezone."), "/admin/settings");
  }
  await setSetting("trackAdminClicks", trackAdminClicks);
  await setSetting("preserveRedirectQuery", preserveRedirectQuery);
  await setSetting("siteName", siteName);
  await setSetting("displayTimeZone", displayTimeZone);
  await setSetting("uploadMaxBytes", uploadMaxBytes);
  await auditLog({
    userId: admin.id,
    action: AuditAction.SETTINGS_CHANGED,
    entityType: "AppSetting",
    details: {
      siteName,
      displayTimeZone,
      trackAdminClicks,
      preserveRedirectQuery,
      uploadMaxBytes
    }
  });
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/theme");
  revalidatePath("/admin/settings/favicons/editor");
  revalidatePath("/admin/tools");
  revalidatePath("/admin/users");
  redirectWithToast(formData, "success", "Settings saved.", "/admin/settings");
}

export async function updateSignInMethodsAction(formData: FormData) {
  try {
    validateCsrf(formData);
  } catch {
    redirectWithToast(formData, "error", "The form expired. Please try again.", "/admin/settings");
  }
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminToastPath("/admin", "error", "Sign in again to continue."));
  const localLoginEnabled = formData.get("localLoginEnabled") === "on";
  const externalAutoProvisionUsers = formData.get("externalAutoProvisionUsers") === "on";
  if (!localLoginEnabled) {
    const current = await getSettings();
    if (!current.externalLoginEnabled) {
      redirectWithToast(formData, "error", "Enable external sign-in before disabling password and passkey sign-in.", "/admin/settings");
    }
    if (current.localLoginEnabled) {
      const identities = await prisma.externalIdentity.findMany({ where: { userId: admin.id }, select: { provider: true } });
      const configs = await getConfiguredExternalProviders();
      if (configs.length === 0 || !identities.some((identity) => isConfiguredExternalIdentity(identity.provider, configs))) {
        redirectWithToast(formData, "error", "Connect and test an external provider in your profile before disabling password and passkey sign-in.", "/admin/settings");
      }
    }
  }
  await setSetting("localLoginEnabled", localLoginEnabled);
  await setSetting("externalAutoProvisionUsers", externalAutoProvisionUsers);
  await auditLog({ userId: admin.id, action: AuditAction.SETTINGS_CHANGED,
    entityType: "AppSetting", details: { localLoginEnabled, externalAutoProvisionUsers } });
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/profile");
  revalidatePath("/bookmarklet");
  redirectWithToast(formData, "success", "Sign-in methods saved.", "/admin/settings");
}

export async function updateDashboardThemeAction(formData: FormData) {
  try {
    validateCsrf(formData);
  } catch {
    redirectWithToast(formData, "error", "The form expired. Please try again.", "/admin/settings/theme");
  }
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminToastPath("/admin", "error", "Sign in again to continue."));

  let dashboardTheme: ReturnType<typeof dashboardThemeFromFormData>;
  try {
    dashboardTheme = dashboardThemeFromFormData(formData);
  } catch (error) {
    redirectWithToast(
      formData,
      "error",
      actionErrorMessage(error, "Check the dashboard theme colors and try again."),
      "/admin/settings/theme"
    );
  }
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
  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/theme");
  redirectWithToast(formData, "success", "Dashboard theme saved.", "/admin/settings/theme");
}

export async function resetDashboardThemeAction(formData: FormData) {
  try {
    validateCsrf(formData);
  } catch {
    redirectWithToast(formData, "error", "The form expired. Please try again.", "/admin/settings/theme");
  }
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminToastPath("/admin", "error", "Sign in again to continue."));

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
  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/theme");
  redirectWithToast(formData, "success", "Dashboard theme reset to the built-in palette.", "/admin/settings/theme");
}

function revalidateCustomPagePaths() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/2fa");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings");
}

function revalidateFaviconPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/settings");
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
  try {
    validateCsrf(formData);
  } catch {
    redirectWithToast(formData, "error", "The form expired. Please try again.", "/admin/settings/favicons/editor");
  }
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminToastPath("/admin", "error", "Sign in again to continue."));

  await setSetting("favicons", null);
  await auditLog({
    userId: admin.id,
    action: AuditAction.SETTINGS_CHANGED,
    entityType: "AppSetting",
    entityId: "favicons",
    details: { favicons: true, removed: true }
  });
  revalidateFaviconPaths();
  redirectWithToast(formData, "success", "Using webroot/default favicons.", "/admin/settings/favicons/editor");
}

export async function updateFaviconManifestAction(formData: FormData) {
  try {
    validateCsrf(formData);
  } catch {
    redirectWithToast(formData, "error", "The form expired. Please try again.", "/admin/settings/favicons/editor");
  }
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminToastPath("/admin", "error", "Sign in again to continue."));

  const settings = await getSettings();
  if (!settings.favicons) {
    redirectWithToast(
      formData,
      "error",
      "Upload favicon files before saving web app names.",
      "/admin/settings/favicons/editor"
    );
  }

  let favicons: ReturnType<typeof faviconsWithManifestNames>;
  try {
    favicons = faviconsWithManifestNames(settings.favicons, formData, settings.siteName);
  } catch (error) {
    redirectWithToast(
      formData,
      "error",
      actionErrorMessage(error, "Check the web app names and try again."),
      "/admin/settings/favicons/editor"
    );
  }
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
  redirectWithToast(formData, "success", "Web app names saved.", "/admin/settings/favicons/editor");
}
