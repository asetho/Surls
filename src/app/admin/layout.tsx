import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { BarChart3, Link2, LogOut, Settings, ShieldCheck, Users, Wrench } from "lucide-react";
import { NewShortUrlModal } from "@/components/NewShortUrlModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requireAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { getSiteName } from "@/lib/settings";

export const dynamic = "force-dynamic";

type ThemeChoice = "light" | "dark" | "auto";

function isThemeChoice(value: string | undefined): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "auto";
}

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, cookieStore, siteName] = await Promise.all([requireAdmin(), cookies(), getSiteName()]);
  if (!user) redirect("/login?next=/admin");
  const csrf = getCsrfToken();
  const cookieChoice = cookieStore.get("surls-theme")?.value;
  const themeChoice = isThemeChoice(cookieChoice) ? cookieChoice : "auto";
  const brandInitial = siteName.slice(0, 1).toUpperCase() || "S";

  const nav = [
    { href: "/admin", label: "Dashboard", icon: BarChart3 },
    { href: "/admin/links", label: "Links", icon: Link2 },
    { href: "/admin/tools", label: "Tools", icon: Wrench },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/settings", label: "Settings", icon: Settings },
    { href: "/admin/profile", label: "Security", icon: ShieldCheck }
  ];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand" href="/admin" style={{ color: "#fff", marginBottom: "1rem" }}>
          <span className="brand-mark" style={{ background: "var(--teal)" }}>{brandInitial}</span>
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
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <strong>{user.name || user.email}</strong>
            <div className="muted small">Private {siteName} admin</div>
          </div>
          <div className="nav-actions">
            <NewShortUrlModal csrf={csrf} siteName={siteName} />
            <form action="/api/auth/logout" method="post">
              <button className="secondary" type="submit">
                <LogOut size={16} aria-hidden />
                Logout
              </button>
            </form>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
