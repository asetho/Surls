import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { BarChart3, Link2, LogOut, Settings, ShieldCheck, Users, Wrench } from "lucide-react";
import { AdminToastHost } from "@/components/AdminToastHost";
import { DashboardThemeDrawer } from "@/components/DashboardThemeDrawer";
import { NewShortUrlModal } from "@/components/NewShortUrlModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { APP_VERSION } from "@/lib/app-version";
import { isAdminUser, requireAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { dashboardThemeCssVariables } from "@/lib/dashboard-theme";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type ThemeChoice = "light" | "dark" | "auto";

function isThemeChoice(value: string | undefined): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "auto";
}

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, cookieStore, settings] = await Promise.all([requireAdmin(), cookies(), getSettings()]);
  if (!user) return <>{children}</>;
  const csrf = getCsrfToken();
  const cookieChoice = cookieStore.get("surls-theme")?.value;
  const themeChoice = isThemeChoice(cookieChoice) ? cookieChoice : "auto";
  const siteName = settings.siteName;
  const adminThemeStyle = dashboardThemeCssVariables(settings.dashboardTheme) as React.CSSProperties;
  const brandInitial = siteName.slice(0, 1).toUpperCase() || "S";
  const hasFaviconBrandMark = Boolean(settings.favicons?.assets.faviconSvg);
  const displayName = user.name || user.email;

  const nav = [
    { href: "/admin", label: "Dashboard", icon: BarChart3 },
    { href: "/admin/links", label: "Links", icon: Link2 },
    { href: "/admin/tools", label: "Tools", icon: Wrench },
    ...(isAdminUser(user) ? [{ href: "/admin/users", label: "Users", icon: Users }] : []),
    ...(isAdminUser(user) ? [{ href: "/admin/settings", label: "Settings", icon: Settings }] : []),
    { href: "/admin/profile", label: "Security", icon: ShieldCheck }
  ];

  return (
    <div className="admin-shell" style={adminThemeStyle}>
      <aside className="admin-sidebar">
        <Link className="brand" href="/admin" style={{ marginBottom: "1rem" }}>
          <span className={hasFaviconBrandMark ? "brand-mark brand-mark-favicon" : "brand-mark"} style={{ background: hasFaviconBrandMark ? undefined : "var(--teal)" }}>
            {hasFaviconBrandMark ? <Image src="/favicon.svg" alt="" aria-hidden="true" width={34} height={34} unoptimized /> : brandInitial}
          </span>
          <span>{siteName}</span>
        </Link>
        <nav aria-label="Admin">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link href={item.href} key={item.href}>
                <Icon size={18} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="admin-sidebar-theme">
          <ThemeToggle initialChoice={themeChoice} iconOnly />
        </div>
        <div className="admin-sidebar-account">
          <span className="muted small">Signed in as</span>
          <strong>{displayName}</strong>
          {user.name ? <span className="admin-sidebar-email">{user.email}</span> : null}
          <form action="/api/auth/logout" method="post">
            <button className="admin-sidebar-logout" type="submit">
              <LogOut size={16} aria-hidden />
              Logout
            </button>
          </form>
          <span className="admin-sidebar-version">Surls v{APP_VERSION}</span>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="nav-actions">
            <NewShortUrlModal csrf={csrf} />
          </div>
        </header>
        <AdminToastHost />
        {children}
      </div>
      {isAdminUser(user) ? <DashboardThemeDrawer csrf={csrf} theme={settings.dashboardTheme} /> : null}
    </div>
  );
}
