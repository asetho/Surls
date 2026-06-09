"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { requireDisplayTimeZone } from "@/lib/dates";
import { normalizeSiteName, setSetting } from "@/lib/settings";

export async function updateSettingsAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
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
