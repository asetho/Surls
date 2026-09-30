import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { BarChart3, ChevronDown, Link2, LogOut, Menu, Settings, UserRound, Users, Wrench, X } from "lucide-react";
import { AdminToastHost } from "@/components/AdminToastHost";
import { DashboardThemeDrawer } from "@/components/DashboardThemeDrawer";
import { NewShortUrlModal } from "@/components/NewShortUrlModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { APP_VERSION } from "@/lib/app-version";
import { isAdminUser, requireAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { dashboardThemeCssVariables } from "@/lib/dashboard-theme";
import { normalizeMobileMenuSide } from "@/lib/mobile-menu";
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
  const mobileMenuSide = normalizeMobileMenuSide(user.mobileMenuSide);
  const brandInitial = siteName.slice(0, 1).toUpperCase() || "S";
  const brandMarkSrc = settings.favicons?.assets.faviconSvg
    ? "/favicon.svg"
    : siteName === "Surls"
      ? "/brand/surls-app-icon.svg"
      : null;
  const displayName = user.name || user.email;

  const nav = [
    { href: "/admin", label: "Dashboard", icon: BarChart3 },
    { href: "/admin/links", label: "Links", icon: Link2 },
    { href: "/admin/tools", label: "Tools", icon: Wrench },
    ...(isAdminUser(user) ? [{ href: "/admin/users", label: "Users", icon: Users }] : []),
    ...(isAdminUser(user) ? [{ href: "/admin/settings", label: "Settings", icon: Settings }] : []),
    { href: "/admin/profile", label: "Profile", icon: UserRound }
  ];

  return (
    <div className="admin-shell" data-mobile-menu-side={mobileMenuSide} style={adminThemeStyle}>
      <aside className="admin-sidebar">
        <input className="admin-sidebar-toggle sr-only" type="checkbox" id="admin-sidebar-toggle" aria-label="Toggle admin navigation" />
        <label className="admin-sidebar-drawer-trigger" htmlFor="admin-sidebar-toggle">
          <span className="brand admin-sidebar-drawer-brand">
            <span className={brandMarkSrc ? "brand-mark brand-mark-favicon" : "brand-mark brand-mark-fallback"}>
              {brandMarkSrc ? <Image src={brandMarkSrc} alt="" aria-hidden="true" width={34} height={34} unoptimized /> : brandInitial}
            </span>
            <span>{siteName}</span>
          </span>
          <span className="admin-sidebar-drawer-action">
            <Menu size={18} aria-hidden />
            Menu
            <ChevronDown className="admin-sidebar-drawer-chevron" size={17} aria-hidden />
          </span>
        </label>
        <label className="admin-sidebar-drawer-backdrop" htmlFor="admin-sidebar-toggle" aria-label="Close admin navigation" />
        <div className="admin-sidebar-drawer-content">
          <div className="admin-sidebar-drawer-panel-header">
            <span className="muted small">Menu</span>
            <label className="admin-sidebar-drawer-close" htmlFor="admin-sidebar-toggle" aria-label="Close admin navigation">
              <X size={17} aria-hidden />
            </label>
          </div>
          <Link className="brand admin-sidebar-brand" href="/admin">
            <span className={brandMarkSrc ? "brand-mark brand-mark-favicon" : "brand-mark brand-mark-fallback"}>
              {brandMarkSrc ? <Image src={brandMarkSrc} alt="" aria-hidden="true" width={34} height={34} unoptimized /> : brandInitial}
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
              <input type="hidden" name="csrf" value={csrf} />
              <button className="admin-sidebar-logout" type="submit">
                <LogOut size={16} aria-hidden />
                Logout
              </button>
            </form>
            <span className="admin-sidebar-version">
              Surls v{APP_VERSION}
            </span>
          </div>
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
