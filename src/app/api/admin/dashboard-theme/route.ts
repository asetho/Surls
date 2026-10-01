import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { auditLog } from "@/lib/audit";
import { requireSiteAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { DEFAULT_DASHBOARD_THEME, dashboardThemeFromFormData } from "@/lib/dashboard-theme";
import { requestOriginMatchesApp } from "@/lib/request";
import { setSetting } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SIDEBAR_BRANDING, type SidebarBranding } from "@/lib/sidebar-branding";
import { sidebarBrandingFromJson, sidebarLogoImage } from "@/lib/sidebar-branding-server";

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

  if (formData.get("intent") === "preview-logo") {
    try {
      const logo = formData.get("logo");
      if (!logo) throw new Error("Choose or paste a logo.");
      return NextResponse.json({ image: await sidebarLogoImage(logo) });
    } catch (error) {
      return NextResponse.json({ error: errorMessage(error, "Could not load logo.") }, { status: 400 });
    }
  }
  const intent = formData.get("intent") === "reset" ? "reset" : "save";
  let dashboardTheme = DEFAULT_DASHBOARD_THEME;
  let sidebarBranding: SidebarBranding | undefined = intent === "reset" ? DEFAULT_SIDEBAR_BRANDING : undefined;
  if (intent === "save") {
    try {
      dashboardTheme = dashboardThemeFromFormData(formData);
      if (formData.has("sidebarBranding")) sidebarBranding = await sidebarBrandingFromJson(String(formData.get("sidebarBranding")));
    } catch (error) {
      return NextResponse.json(
        { error: errorMessage(error, "Check the dashboard theme colors and try again.") },
        { status: 400 }
      );
    }
  }

  if (sidebarBranding) {
    const branding = sidebarBranding;
    await prisma.$transaction(async (client) => {
      await setSetting("dashboardTheme", dashboardTheme, client);
      await setSetting("sidebarBranding", branding, client);
    });
  } else {
    // Older callers saving palette colors leave sidebar branding unchanged.
    await setSetting("dashboardTheme", dashboardTheme);
  }
  await auditLog({
    userId: admin.id,
    action: AuditAction.SETTINGS_CHANGED,
    entityType: "AppSetting",
    entityId: "dashboardTheme",
    details: { dashboardTheme: intent === "reset" ? "default" : dashboardTheme,
      ...(sidebarBranding ? { sidebarBranding: { logo: sidebarBranding.logo, text: sidebarBranding.text, hasLightImage: Boolean(sidebarBranding.lightImage), hasDarkImage: Boolean(sidebarBranding.darkImage) } } : {}) }
  });
  revalidateDashboardThemePaths();

  return NextResponse.json({
    dashboardTheme,
    ...(sidebarBranding ? { sidebarBranding } : {}),
    message: intent === "reset" ? "Dashboard theme and sidebar branding reset to defaults." : "Dashboard theme saved."
  });
}
