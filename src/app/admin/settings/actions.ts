"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { setSetting } from "@/lib/settings";

export async function updateSettingsAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  await setSetting("trackAdminClicks", formData.get("trackAdminClicks") === "on");
  await setSetting("preserveRedirectQuery", formData.get("preserveRedirectQuery") === "on");
  await setSetting("siteName", String(formData.get("siteName") ?? "Surls").trim() || "Surls");
  await auditLog({
    userId: admin.id,
    action: AuditAction.SETTINGS_CHANGED,
    entityType: "AppSetting",
    details: {
      trackAdminClicks: formData.get("trackAdminClicks") === "on",
      preserveRedirectQuery: formData.get("preserveRedirectQuery") === "on"
    }
  });
  revalidatePath("/admin/settings");
}
