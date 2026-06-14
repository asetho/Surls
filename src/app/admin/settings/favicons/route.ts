import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { requireSiteAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { appBaseUrl } from "@/lib/env";
import { faviconsFromUpload, getFaviconManifestNames } from "@/lib/favicons";
import { getSettings, setSetting } from "@/lib/settings";

function settingsFeedbackUrl(kind: "settingsError" | "settingsSuccess", message: string) {
  const url = new URL("/admin/settings/favicons/editor", appBaseUrl());
  url.searchParams.set(kind, message.slice(0, 240));
  url.searchParams.set("settingsSection", "favicons");
  return url;
}

function redirectToSettings(kind: "settingsError" | "settingsSuccess", message: string) {
  return NextResponse.redirect(settingsFeedbackUrl(kind, message), 303);
}

function uploadErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not upload that favicon package.";
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

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
    validateCsrf(formData);
  } catch {
    return redirectToSettings("settingsError", "The form expired. Please try again.");
  }

  const admin = await requireSiteAdmin();
  if (!admin) {
    return NextResponse.redirect(new URL("/admin?next=/admin/settings/favicons/editor", appBaseUrl()), 303);
  }

  const settings = await getSettings();
  const currentManifestNames = getFaviconManifestNames(settings.favicons, settings.siteName);
  let favicons: Awaited<ReturnType<typeof faviconsFromUpload>>;
  try {
    favicons = await faviconsFromUpload(formData, {
      existingFavicons: settings.favicons,
      manifestName: currentManifestNames.name,
      manifestShortName: currentManifestNames.shortName,
      siteName: settings.siteName
    });
  } catch (error) {
    return redirectToSettings("settingsError", uploadErrorMessage(error));
  }

  await setSetting("favicons", favicons);
  await auditLog({
    userId: admin.id,
    action: AuditAction.SETTINGS_CHANGED,
    entityType: "AppSetting",
    entityId: "favicons",
    details: {
      favicons: true,
      files: Object.values(favicons.assets).map((asset) => ({
        fileName: asset.fileName,
        size: asset.size
      })),
      manifestName: favicons.manifestName,
      manifestShortName: favicons.manifestShortName,
      hasManifest: Boolean(favicons.siteManifest)
    }
  });
  revalidateFaviconPaths();

  return redirectToSettings("settingsSuccess", "Favicon files saved.");
}
