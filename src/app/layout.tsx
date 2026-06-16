import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeScript } from "@/components/ThemeScript";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DEFAULT_DASHBOARD_THEME, dashboardThemeCssVariables } from "@/lib/dashboard-theme";
import { FAVICON_MANIFEST_PATH } from "@/lib/favicons";
import { getSettings, getSiteName } from "@/lib/settings";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: DEFAULT_DASHBOARD_THEME.light.background },
    { media: "(prefers-color-scheme: dark)", color: DEFAULT_DASHBOARD_THEME.dark.background }
  ]
};

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName();
  return {
    title: {
      default: siteName,
      template: `%s | ${siteName}`
    },
    description: `${siteName} is a personal short URL system for managing private links, redirects, and click statistics.`,
    applicationName: siteName,
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/favicon.svg", type: "image/svg+xml" }
      ],
      apple: [{ url: "/apple-touch-icon.png" }]
    },
    manifest: FAVICON_MANIFEST_PATH
  };
}

type ThemeChoice = "light" | "dark" | "auto";

function isThemeChoice(value: string | undefined): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "auto";
}

async function savedThemeChoice() {
  const cookieStore = await cookies();
  const cookieChoice = cookieStore.get("surls-theme")?.value;
  return isThemeChoice(cookieChoice) ? cookieChoice : "auto";
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [themeChoice, settings] = await Promise.all([savedThemeChoice(), getSettings()]);
  const initialTheme = themeChoice === "dark" ? "dark" : "light";
  const dashboardThemeStyle = dashboardThemeCssVariables(settings.dashboardTheme) as CSSProperties;

  return (
    <html lang="en" data-theme={initialTheme} data-theme-choice={themeChoice} style={dashboardThemeStyle} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://use.typekit.net" />
        <link rel="preconnect" href="https://p.typekit.net" />
        <link rel="stylesheet" href="https://use.typekit.net/ynp6ech.css" />
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}

export async function PublicHeader() {
  const [themeChoice, siteName] = await Promise.all([savedThemeChoice(), getSiteName()]);
  const brandInitial = siteName.slice(0, 1).toUpperCase() || "S";

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link className="brand" href="/">
          <span className="brand-mark">{brandInitial}</span>
          <span>{siteName}</span>
        </Link>
        <nav className="nav-actions" aria-label="Primary">
          <Link href="/privacy">Privacy</Link>
          <Link href="/cookies">Cookies</Link>
          <ThemeToggle initialChoice={themeChoice} />
          <Link className="button" href="/admin">
            Admin login
          </Link>
        </nav>
      </div>
    </header>
  );
}
