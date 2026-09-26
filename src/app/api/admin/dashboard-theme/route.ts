import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { auditLog } from "@/lib/audit";
import { requireSiteAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { DEFAULT_DASHBOARD_THEME, dashboardThemeFromFormData } from "@/lib/dashboard-theme";
import { requestOriginMatchesApp } from "@/lib/request";
import { setSetting } from "@/lib/settings";

function revalidateDashboardThemePaths() {
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/theme");
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(request: NextRequest) {
  const admin = await requireSiteAdmin();
  if (!admin) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  if (!requestOriginMatchesApp(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const formData = await request.formData();

  try {
    validateCsrf(formData);
  } catch {
    return NextResponse.json({ error: "The form expired. Please try again." }, { status: 400 });
  }

  const intent = formData.get("intent") === "reset" ? "reset" : "save";
  let dashboardTheme = DEFAULT_DASHBOARD_THEME;
  if (intent === "save") {
    try {
      dashboardTheme = dashboardThemeFromFormData(formData);
    } catch (error) {
      return NextResponse.json(
        { error: errorMessage(error, "Check the dashboard theme colors and try again.") },
        { status: 400 }
      );
    }
  }

  await setSetting("dashboardTheme", dashboardTheme);
  await auditLog({
    userId: admin.id,
    action: AuditAction.SETTINGS_CHANGED,
    entityType: "AppSetting",
    entityId: "dashboardTheme",
    details: { dashboardTheme: intent === "reset" ? "default" : dashboardTheme }
  });
  revalidateDashboardThemePaths();

  return NextResponse.json({
    dashboardTheme,
    message: intent === "reset" ? "Dashboard theme reset to the built-in palette." : "Dashboard theme saved."
  });
}
